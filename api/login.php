<?php
// ---------------------------------------------------------
// LOGIN SÉCURISÉ + ANTI BRUTE-FORCE (VERSION BLINDÉE)
// ---------------------------------------------------------

require_once __DIR__ . "/cors.php";
require_once __DIR__ . "/db.php";
// Démarre la session ici (premier fichier de l'app) 
session_start();

header("Content-Type: application/json; charset=UTF-8");

// ---------------------------------------------------------
// Fonction utilitaire : IP client normalisée
// ---------------------------------------------------------
function getUserIP() {
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        return trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
    }
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        return $_SERVER['HTTP_CLIENT_IP'];
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

// ---------------------------------------------------------
// 1) Protection brute-force par IP
// ---------------------------------------------------------
$ip = getUserIP();
if ($ip === '::1') {
    $ip = '127.0.0.1';
}

$maxAttempts   = 5;        // Nombre max de tentatives
$blockDuration = 15 * 60;  // 15 minutes

try {
    $stmt = $pdo->prepare("
        SELECT attempts, last_attempt 
        FROM login_attempts 
        WHERE ip = :ip
    ");
    $stmt->execute([':ip' => $ip]);
    $attempt = $stmt->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    error_log("Erreur SQL login_attempts (SELECT): " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Identifiants incorrects."]);
    exit;
}

if ($attempt) {
    $elapsed = time() - strtotime($attempt['last_attempt']);

    if ($attempt['attempts'] >= $maxAttempts && $elapsed < $blockDuration) {
        // Blocage actif → réponse neutre
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Identifiants incorrects."
        ]);
        exit;
    }

    // Blocage expiré → reset
    if ($attempt['attempts'] >= $maxAttempts && $elapsed >= $blockDuration) {
        try {
            $pdo->prepare("
                DELETE FROM login_attempts 
                WHERE ip = :ip
            ")->execute([':ip' => $ip]);
        } catch (PDOException $e) {
            error_log("Erreur SQL login_attempts (DELETE): " . $e->getMessage());
        }
        $attempt = null;
    }
}

// ---------------------------------------------------------
// 2) Vérification méthode HTTP
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Méthode non autorisée."]);
    exit;
}

// ---------------------------------------------------------
// 3) Lecture du JSON
// ---------------------------------------------------------
$raw  = file_get_contents("php://input");
$data = json_decode($raw);

if (!$data || !is_object($data)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Requête invalide."]);
    exit;
}

// ---------------------------------------------------------
// 4) Validation des champs
// ---------------------------------------------------------
$emailRaw    = $data->email ?? null;
$passwordRaw = $data->password ?? null;

if (!is_string($emailRaw) || !is_string($passwordRaw)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Identifiants incorrects."]);
    exit;
}

$email    = strtolower(trim($emailRaw));
$password = $passwordRaw;

// Longueurs max
if (strlen($email) === 0 || strlen($email) > 255 || strlen($password) === 0 || strlen($password) > 255) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Identifiants incorrects."]);
    exit;
}

// Validation email (format)
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Identifiants incorrects."]);
    exit;
}

// Optionnel : longueur minimale du mot de passe (8)
if (strlen($password) < 8) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Identifiants incorrects."]);
    exit;
}

// ---------------------------------------------------------
// 5) Requête SQL sécurisée
// ---------------------------------------------------------
try {
    $stmt = $pdo->prepare("
        SELECT id, pseudo, email, password, role
        FROM users 
        WHERE email = :email 
        LIMIT 1
    ");
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    error_log("Erreur SQL login (SELECT user): " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Identifiants incorrects."]);
    exit;
}

// ---------------------------------------------------------
// 6) Vérification de l'utilisateur + mot de passe
// ---------------------------------------------------------
$valid = true;

if (!$user) {
    $valid = false;
} else {
    $hash = $user['password'] ?? '';
    if (!is_string($hash) || $hash === '' || !password_verify($password, $hash)) {
        $valid = false;
    }
}

if (!$valid) {
    // Tentative ratée → incrémenter login_attempts
    try {
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
    } catch (PDOException $e) {
        error_log("Erreur SQL login_attempts (update on fail): " . $e->getMessage());
    }

    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Identifiants incorrects."]);
    exit;
}

// ---------------------------------------------------------
// 7) Succès → reset des tentatives + normalisation des données
// ---------------------------------------------------------
try {
    $pdo->prepare("
        DELETE FROM login_attempts 
        WHERE ip = :ip
    ")->execute([':ip' => $ip]);
} catch (PDOException $e) {
    error_log("Erreur SQL login_attempts (reset on success): " . $e->getMessage());
}

// Nettoyage des données renvoyées
unset($user['password']);

// Normalisation du rôle
$roleFromDb = $user['role'] ?? 'user';
if ($roleFromDb === 'admin') {
    $user['role'] = 'admin';
} else {
    $user['role'] = 'user';
}

// --------------------------------------------------------- 
// 8) Création de la session utilisateur 
// --------------------------------------------------------- 
$_SESSION['user_id'] = $user['id']; 
$_SESSION['role'] = $user['role']; 

// ---------------------------------------------------------
// 9) Réponse finale
// ---------------------------------------------------------
echo json_encode([
    "success" => true,
    "user"    => $user
]);
exit;
