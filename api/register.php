<?php
/* 
require_once 'db.php';

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->pseudo) && !empty($data->email) && !empty($data->password)) {
    // On hache le mot de passe pour la sécurité
    $hashedPassword = password_hash($data->password, PASSWORD_DEFAULT);

    try {
        $stmt = $pdo->prepare("INSERT INTO users (pseudo, email, password) VALUES (?, ?, ?)");
        $stmt->execute([$data->pseudo, $data->email, $hashedPassword]);
        echo json_encode(["success" => true, "message" => "Compte créé !"]);
    } catch (PDOException $e) {
        echo json_encode(["success" => false, "message" => "L'email existe déjà."]);
    }
}
*/


// ---------------------------------------------------------
// Version sécurisée et optimisée
// ---------------------------------------------------------

require_once __DIR__ . "/cors.php";
require_once __DIR__ . '/db.php';

header("Content-Type: application/json; charset=UTF-8");

// Vérification méthode HTTP
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Méthode non autorisée."]);
    return;
}

// Lecture du JSON
$raw = file_get_contents("php://input");
$data = json_decode($raw);

if (!$data) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "JSON invalide."]);
    return;
}

// Validation des champs
$pseudo   = trim($data->pseudo ?? '');
$email    = trim($data->email ?? '');
$password = $data->password ?? '';

if ($pseudo === '' || $email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Tous les champs sont obligatoires."]);
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

// Hash du mot de passe
$hashedPassword = password_hash($password, PASSWORD_DEFAULT);

// Insertion SQL
try {
    $stmt = $pdo->prepare("
        INSERT INTO users (pseudo, email, password) 
        VALUES (:pseudo, :email, :password)
    ");

    $stmt->execute([
        ':pseudo'   => $pseudo,
        ':email'    => $email,
        ':password' => $hashedPassword
    ]);

    echo json_encode(["success" => true, "message" => "Compte créé !"]);
    return;

} catch (PDOException $e) {

    // Gestion propre du duplicate email (erreur MySQL 1062)
    if ($e->errorInfo[1] === 1062) {
        http_response_code(409);
        echo json_encode(["success" => false, "message" => "Cet email est déjà utilisé."]);
        return;
    }

    // Autres erreurs SQL
    error_log('Erreur register: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erreur interne."]);
    return;
}
