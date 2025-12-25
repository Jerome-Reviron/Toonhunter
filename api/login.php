<?php
/* 
require_once 'db.php';

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->email) && !empty($data->password)) {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$data->email]);
    $user = $stmt->fetch();

    if ($user && password_verify($data->password, $user['password'])) {
        unset($user['password']); // Sécurité : on ne renvoie pas le mot de passe
        echo json_encode(["success" => true, "user" => $user]);
    } else {
        echo json_encode(["success" => false, "message" => "Identifiants incorrects."]);
    }
}
*/


// ---------------------------------------------------------
// Version sécurisée et optimisée
// ---------------------------------------------------------

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
$email    = trim($data->email ?? '');
$password = $data->password ?? '';

if ($email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Email et mot de passe requis."]);
    return;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Email invalide."]);
    return;
}

// Requête SQL sécurisée
try {
    $stmt = $pdo->prepare("
        SELECT id, pseudo, email, password, role, isPaid 
        FROM users 
        WHERE email = :email 
        LIMIT 1
    ");
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();
} catch (PDOException $e) {
    error_log("Erreur SQL login: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erreur interne."]);
    return;
}

// Vérification du mot de passe
if ($user && password_verify($password, $user['password'])) {
    unset($user['password']); // on ne renvoie jamais le hash
    echo json_encode(["success" => true, "user" => $user]);
    return;
}

// Identifiants incorrects
http_response_code(401);
echo json_encode(["success" => false, "message" => "Identifiants incorrects."]);
