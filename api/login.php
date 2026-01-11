<?php
// ---------------------------------------------------------
// LOGIN SÉCURISÉ + ANTI BRUTE-FORCE
// ---------------------------------------------------------

require_once __DIR__ . "/cors.php";
require_once __DIR__ . '/db.php';
date_default_timezone_set('Europe/Paris');


header("Content-Type: application/json; charset=UTF-8");

function getUserIP() {
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        return trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
    }
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        return $_SERVER['HTTP_CLIENT_IP'];
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

error_log("REMOTE_ADDR = " . $_SERVER['REMOTE_ADDR']);

// ---------------------------------------------------------
// 1) Protection brute-force par IP
// ---------------------------------------------------------
$ip = getUserIP();
if ($ip === '::1') {
    $ip = '127.0.0.1';
}
$maxAttempts = 5;          // Nombre max de tentatives
$blockDuration = 15*60;  // 15 minutes

// Vérifier si l'IP est bloquée
$stmt = $pdo->prepare("SELECT attempts, last_attempt FROM login_attempts WHERE ip = :ip");
$stmt->execute([':ip' => $ip]);
$attempt = $stmt->fetch();

if ($attempt) {
    $elapsed = time() - strtotime($attempt['last_attempt']);

    if ($attempt['attempts'] >= $maxAttempts) {
        if ($elapsed < $blockDuration) {
            http_response_code(429);
            echo json_encode([
                "success" => false,
                "message" => "Trop de tentatives. Réessayez dans 15 minutes."
            ]);
            return;
        } else {
            // 🔓 Blocage expiré → on reset
            $pdo->prepare("DELETE FROM login_attempts WHERE ip = :ip")->execute([':ip' => $ip]);
        }
    }
}


// ---------------------------------------------------------
// 2) Vérification méthode HTTP
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Méthode non autorisée."]);
    return;
}

// ---------------------------------------------------------
// 3) Lecture du JSON
// ---------------------------------------------------------
$raw = file_get_contents("php://input");
$data = json_decode($raw);

if (!$data) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "JSON invalide."]);
    return;
}

// ---------------------------------------------------------
// 4) Validation des champs
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// 5) Requête SQL sécurisée
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// 6) Vérification du mot de passe
// ---------------------------------------------------------
if ($user && password_verify($password, $user['password'])) {

    // Reset des tentatives
    $pdo->prepare("DELETE FROM login_attempts WHERE ip = :ip")->execute([':ip' => $ip]);

    unset($user['password']);
    $user['isPaid'] = intval($user['isPaid']); // conversion sécurisée

    echo json_encode(["success" => true, "user" => $user]);
    return;
}

// ---------------------------------------------------------
// 7) Mot de passe incorrect → enregistrer tentative
// ---------------------------------------------------------
if ($attempt) {
    $pdo->prepare("
        UPDATE login_attempts 
        SET attempts = attempts + 1, last_attempt = NOW() 
        WHERE ip = :ip
    ")->execute([':ip' => $ip]);
} else {
    $pdo->prepare("
        INSERT INTO login_attempts (ip, attempts, last_attempt) 
        VALUES (:ip, 1, NOW())
    ")->execute([':ip' => $ip]);
}

http_response_code(401);
echo json_encode(["success" => false, "message" => "Identifiants incorrects."]);
