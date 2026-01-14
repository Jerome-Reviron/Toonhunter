<?php
require_once __DIR__ . "/cors.php";
require_once __DIR__ . "/db.php";

header("Content-Type: application/json; charset=UTF-8");

// ---------------------------------------------------------
// 1) Vérification méthode HTTP
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Méthode non autorisée."]);
    exit;
}

// ---------------------------------------------------------
// 2) Lecture + validation JSON
// ---------------------------------------------------------
$raw = file_get_contents("php://input");
$data = json_decode($raw);

if (
    !$data ||
    empty($data->email) ||
    empty($data->code) ||
    empty($data->password)
) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Requête invalide."]);
    exit;
}

$email       = strtolower(trim($data->email));
$code        = trim($data->code);
$newPassword = $data->password;

// Validation email
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Code invalide."]);
    exit;
}

// Validation code (6 chiffres)
if (!preg_match('/^[0-9]{6}$/', $code)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Code invalide."]);
    exit;
}

// Validation mot de passe (min 8 caractères, max 255 par sécurité)
if (!is_string($newPassword) || strlen($newPassword) < 8 || strlen($newPassword) > 255) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Mot de passe invalide."
    ]);
    exit;
}

// ---------------------------------------------------------
// 3) Anti-bruteforce par IP (5 tentatives / 15 min)
// Réutilise la table reset_attempts (même logique que verify-reset-code.php)
// ---------------------------------------------------------
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

$attempt = null;

try {
    $stmt = $pdo->prepare("
        SELECT attempts, last_attempt 
        FROM reset_attempts 
        WHERE ip = :ip
    ");
    $stmt->execute([':ip' => $ip]);
    $attempt = $stmt->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    error_log("Erreur SQL reset-password (select attempts): " . $e->getMessage());
    // On ne révèle rien au client, on reste neutre
}

$maxAttempts = 5;
$blockTime   = 15 * 60;

if ($attempt) {
    $elapsed = time() - strtotime($attempt['last_attempt']);

    if ($attempt['attempts'] >= $maxAttempts && $elapsed < $blockTime) {
        http_response_code(429);
        echo json_encode(["success" => false, "message" => "Code invalide."]);
        exit;
    }

    if ($attempt['attempts'] >= $maxAttempts && $elapsed >= $blockTime) {
        // Délai dépassé → reset des tentatives
        try {
            $pdo->prepare("DELETE FROM reset_attempts WHERE ip = :ip")->execute([':ip' => $ip]);
        } catch (PDOException $e) {
            error_log("Erreur SQL reset-password (delete old attempts): " . $e->getMessage());
        }
        $attempt = null;
    }
}

// ---------------------------------------------------------
// 4) Récupération du dernier code pour cet email
// ---------------------------------------------------------
try {
    $stmt = $pdo->prepare("
        SELECT token, expires_at 
        FROM password_resets 
        WHERE email = :email 
        ORDER BY id DESC 
        LIMIT 1
    ");
    $stmt->execute([':email' => $email]);
    $reset = $stmt->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    error_log("Erreur SQL reset-password (select reset): " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Code invalide."]);
    exit;
}

// ---------------------------------------------------------
// 5) Vérifications neutres (pas de fuite d'information)
// ---------------------------------------------------------
$valid = true;

// Pas de code trouvé
if (!$reset) {
    $valid = false;
}
// Expiré
elseif (strtotime($reset['expires_at']) < time()) {
    $valid = false;
}
// Code incorrect
elseif ($reset['token'] !== $code) {
    $valid = false;
}

// ---------------------------------------------------------
// 6) Gestion des tentatives si invalide
// ---------------------------------------------------------
if (!$valid) {
    try {
        if ($attempt) {
            $pdo->prepare("
                UPDATE reset_attempts 
                SET attempts = attempts + 1, last_attempt = NOW() 
                WHERE ip = :ip
            ")->execute([':ip' => $ip]);
        } else {
            $pdo->prepare("
                INSERT INTO reset_attempts (ip, attempts, last_attempt) 
                VALUES (:ip, 1, NOW())
            ")->execute([':ip' => $ip]);
        }
    } catch (PDOException $e) {
        error_log("Erreur SQL reset-password (update attempts): " . $e->getMessage());
    }

    echo json_encode(["success" => false, "message" => "Code invalide."]);
    exit;
}

// ---------------------------------------------------------
// 7) Code valide → mise à jour du mot de passe
// ---------------------------------------------------------

// Hash du nouveau mot de passe
$hashed = password_hash($newPassword, PASSWORD_DEFAULT);

try {
    // Mise à jour du mot de passe utilisateur
    $stmt = $pdo->prepare("
        UPDATE users 
        SET password = :password 
        WHERE email = :email
    ");
    $stmt->execute([
        ':password' => $hashed,
        ':email'    => $email
    ]);

    // Suppression de tous les codes de reset pour cet email
    $stmt = $pdo->prepare("
        DELETE FROM password_resets 
        WHERE email = :email
    ");
    $stmt->execute([':email' => $email]);

    // Reset des tentatives pour cette IP
    $stmt = $pdo->prepare("
        DELETE FROM reset_attempts 
        WHERE ip = :ip
    ");
    $stmt->execute([':ip' => $ip]);

} catch (PDOException $e) {
    error_log("Erreur SQL reset-password (update user / cleanup): " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Une erreur est survenue."]);
    exit;
}

// ---------------------------------------------------------
// 8) Réponse finale
// ---------------------------------------------------------
echo json_encode(["success" => true, "message" => "Mot de passe mis à jour."]);
exit;
