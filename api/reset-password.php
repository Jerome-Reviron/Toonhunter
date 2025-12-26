<?php
/* 
Ancienne version inexistante — nouveau fichier.
*/

// ---------------------------------------------------------
// Version sécurisée : reset-password.php
// ---------------------------------------------------------

require_once __DIR__ . '/db.php';

header("Content-Type: application/json; charset=UTF-8");

// Vérification méthode HTTP
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Méthode non autorisée."]);
    exit;
}

// Lecture du JSON
$raw = file_get_contents("php://input");
$data = json_decode($raw);

if (!$data || empty($data->email) || empty($data->code) || empty($data->password)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Champs manquants."]);
    exit;
}

$email = trim($data->email);
$code = trim($data->code);
$newPassword = $data->password;

// Vérifie si un code existe pour cet email
$stmt = $pdo->prepare("
    SELECT token, expires_at 
    FROM password_resets 
    WHERE email = :email 
    ORDER BY id DESC 
    LIMIT 1
");
$stmt->execute([':email' => $email]);
$reset = $stmt->fetch();

if (!$reset) {
    echo json_encode(["success" => false, "message" => "Code invalide."]);
    exit;
}

// Vérifie expiration
if (strtotime($reset['expires_at']) < time()) {
    echo json_encode(["success" => false, "message" => "Code expiré."]);
    exit;
}

// Vérifie le code
if ($reset['token'] !== $code) {
    echo json_encode(["success" => false, "message" => "Code incorrect."]);
    exit;
}

// Hash du nouveau mot de passe
$hashed = password_hash($newPassword, PASSWORD_DEFAULT);

// Mise à jour du mot de passe
$stmt = $pdo->prepare("UPDATE users SET password = :password WHERE email = :email");
$stmt->execute([
    ':password' => $hashed,
    ':email' => $email
]);

// Suppression du code
$pdo->prepare("DELETE FROM password_resets WHERE email = :email")->execute([':email' => $email]);

echo json_encode(["success" => true, "message" => "Mot de passe mis à jour."]);
