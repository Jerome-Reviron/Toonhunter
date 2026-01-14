<?php
// ---------------------------------------------------------
// LOGIN SÉCURISÉ + ANTI BRUTE-FORCE
// ---------------------------------------------------------

require_once __DIR__ . "/cors.php";
require_once __DIR__ . '/db.php';

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

error_log("REMOTE_ADDR = " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));

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
    $stmt = $pdo->prepare("SELECT attempts, last_attempt FROM login_attempts WHERE ip = :ip");
    $stmt->execute([':ip' => $ip]);
    $attempt = $stmt->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    error_log("Erreur SQL login_attempts (SELECT): " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erreur interne."]);
    exit;
}

if ($attempt) {
    $elapsed = time() - strtotime($attempt['last_attempt']);

    if ($attempt['attempts'] >= $maxAttempts && $elapsed < $blockDuration) {
        http_response_code(429);
        echo json_encode([
            "success" => false,
            "message" => "Trop de tentatives. Réessayez dans 15 minutes."
        ]);
        exit;
    }

    // Blocage expiré → reset
    if ($attempt['attempts'] >= $maxAttempts && $elapsed >= $blockDuration) {
        try {
            $pdo->prepare("DELETE FROM login_attempts WHERE ip = :ip")->execute([':ip' => $ip]);
        } catch (PDOException $e) {
            error_log("Erreur SQL login_attempts (DELETE): " . $e->getMessage());
        }
        $attempt = null; // on repart propre
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

if (!$data) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "JSON invalide."]);
    exit;
}

// ---------------------------------------------------------
// 4) Validation des champs
// ---------------------------------------------------------
$email    = trim($data->email ?? '');
$password = $data->password ?? '';

if ($email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Email et mot de passe requis."]);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Email invalide."]);
    exit;
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
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    error_log("Erreur SQL login (SELECT user): " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erreur interne."]);
    exit;
}

// ---------------------------------------------------------
// 6) Vérification de l'existence de l'utilisateur
// ---------------------------------------------------------
if (!$user) {
    // On compte quand même comme tentative ratée
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
        error_log("Erreur SQL login_attempts (user not found): " . $e->getMessage());
    }

    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Identifiants incorrects."]);
    exit;
}

// ---------------------------------------------------------
// 7) Vérification du mot de passe
// ---------------------------------------------------------
$hash = $user['password'] ?? '';

if (!is_string($hash) || $hash === '' || !password_verify($password, $hash)) {
    // Mot de passe incorrect → enregistrer la tentative
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
        error_log("Erreur SQL login_attempts (bad password): " . $e->getMessage());
    }

    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Identifiants incorrects."]);
    exit;
}

// ---------------------------------------------------------
// 8) Succès → reset des tentatives + normalisation des données
// ---------------------------------------------------------
try {
    $pdo->prepare("DELETE FROM login_attempts WHERE ip = :ip")->execute([':ip' => $ip]);
} catch (PDOException $e) {
    error_log("Erreur SQL login_attempts (reset on success): " . $e->getMessage());
}

// On nettoie les données renvoyées
unset($user['password']);

// Normalisation isPaid en entier 0/1
$user['isPaid'] = ($user['isPaid'] == 1) ? 1 : 0;

// Normalisation du rôle (anti-falsification BDD)
// Seule la valeur EXACTE 'admin' est acceptée
$roleFromDb = $user['role'] ?? 'user';

if ($roleFromDb === 'admin') {
    $user['role'] = 'admin';
} else {
    $user['role'] = 'user';
}

// ---------------------------------------------------------
// 9) Réponse finale
// ---------------------------------------------------------
echo json_encode([
    "success" => true,
    "user"    => $user
]);
exit;
