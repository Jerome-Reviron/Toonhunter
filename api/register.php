<?php
require_once __DIR__ . "/cors.php";
require_once __DIR__ . '/db.php';

header("Content-Type: application/json; charset=UTF-8");

// ---------------------------------------------------------
// 1) Vérification méthode HTTP
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Méthode non autorisée."]);
    return;
}

// ---------------------------------------------------------
// 2) Lecture du JSON
// ---------------------------------------------------------
$raw = file_get_contents("php://input");
$data = json_decode($raw);

if (!$data) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "JSON invalide."]);
    return;
}

// ---------------------------------------------------------
// 3) Extraction + normalisation
// ---------------------------------------------------------
$pseudo   = trim($data->pseudo ?? '');
$email    = strtolower(trim($data->email ?? ''));
$password = $data->password ?? '';

// ---------------------------------------------------------
// 4) Validation des champs
// ---------------------------------------------------------
if ($pseudo === '' || $email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Tous les champs sont obligatoires."]);
    return;
}

// Longueurs max
if (strlen($pseudo) > 50) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Pseudo trop long (max 50 caractères)."]);
    return;
}

if (strlen($email) > 100) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Email trop long (max 100 caractères)."]);
    return;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Email invalide."]);
    return;
}

if (strlen($password) < 8) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Mot de passe trop court (min 8 caractères)."]);
    return;
}

if (strlen($password) > 200) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Mot de passe trop long."]);
    return;
}

// Mot de passe : majuscule, minuscule, chiffre, caractère spécial
$regexPassword = '/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/';

if (!preg_match($regexPassword, $password)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Le mot de passe doit contenir au minimum : une majuscule, une minuscule, un chiffre et un caractère spécial."
    ]);
    return;
}

// Protection pseudo (anti-XSS / anti-injection)
if (preg_match('/[<>\"\']/', $pseudo)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Pseudo invalide."]);
    return;
}

// ---------------------------------------------------------
// 5) Hash du mot de passe
// ---------------------------------------------------------
$hashedPassword = password_hash($password, PASSWORD_DEFAULT);

// ---------------------------------------------------------
// 6) Insertion SQL
// ---------------------------------------------------------
try {
    $stmt = $pdo->prepare("
        INSERT INTO users (pseudo, email, password, role, isPaid) 
        VALUES (:pseudo, :email, :password, 'user', 0)
    ");

    $stmt->execute([
        ':pseudo'   => $pseudo,
        ':email'    => $email,
        ':password' => $hashedPassword
    ]);

    echo json_encode(["success" => true, "message" => "Compte créé !"]);
    return;

} catch (PDOException $e) {

    if ($e->errorInfo[1] === 1062) {
        http_response_code(409);
        echo json_encode(["success" => false, "message" => "Cet email est déjà utilisé."]);
        return;
    }

    error_log('Erreur register: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erreur interne."]);
    return;
}
