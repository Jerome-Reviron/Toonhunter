<?php
require_once __DIR__ . "/cors.php";
require_once __DIR__ . "/db.php";

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
// 1) Protection brute-force par IP (register_attempts)
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
        FROM register_attempts 
        WHERE ip = :ip
    ");
    $stmt->execute([':ip' => $ip]);
    $attempt = $stmt->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    error_log("Erreur SQL register_attempts (SELECT): " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Impossible de créer le compte."]);
    exit;
}

if ($attempt) {
    $elapsed = time() - strtotime($attempt['last_attempt']);

    if ($attempt['attempts'] >= $maxAttempts && $elapsed < $blockDuration) {
        // Blocage actif → réponse neutre
        http_response_code(429);
        echo json_encode([
            "success" => false,
            "message" => "Impossible de créer le compte."
        ]);
        exit;
    }

    // Blocage expiré → reset
    if ($attempt['attempts'] >= $maxAttempts && $elapsed >= $blockDuration) {
        try {
            $pdo->prepare("
                DELETE FROM register_attempts 
                WHERE ip = :ip
            ")->execute([':ip' => $ip]);
        } catch (PDOException $e) {
            error_log("Erreur SQL register_attempts (DELETE): " . $e->getMessage());
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
// 4) Extraction + validation des types
// ---------------------------------------------------------
$pseudoRaw   = $data->pseudo   ?? null;
$emailRaw    = $data->email    ?? null;
$passwordRaw = $data->password ?? null;

if (!is_string($pseudoRaw) || !is_string($emailRaw) || !is_string($passwordRaw)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Impossible de créer le compte."]);
    exit;
}

// Normalisation
$pseudo   = trim($pseudoRaw);
$email    = strtolower(trim($emailRaw));
$password = $passwordRaw;

// ---------------------------------------------------------
// 5) Validation des champs (longueurs / formats)
// ---------------------------------------------------------
if ($pseudo === '' || $email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Impossible de créer le compte."]);
    exit;
}

// Longueurs max
if (strlen($pseudo) > 50 || strlen($email) > 255 || strlen($password) > 255) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Impossible de créer le compte."]);
    exit;
}

// Validation email (format)
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Impossible de créer le compte."]);
    exit;
}

// Longueur minimale mot de passe
if (strlen($password) < 8) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Impossible de créer le compte."]);
    exit;
}

// Mot de passe : majuscule, minuscule, chiffre, caractère spécial
$regexPassword = '/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/';

if (!preg_match($regexPassword, $password)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Impossible de créer le compte."
    ]);
    exit;
}

// Validation pseudo : lettres, chiffres, espaces, _ - . (adaptable)
$regexPseudo = '/^[a-zA-Z0-9 _\-.]{3,50}$/';

if (!preg_match($regexPseudo, $pseudo)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Impossible de créer le compte."]);
    exit;
}

// ---------------------------------------------------------
// 6) Vérification doublon email / pseudo (réponse neutre)
// ---------------------------------------------------------
try {
    $stmt = $pdo->prepare("
        SELECT id 
        FROM users 
        WHERE email = :email OR pseudo = :pseudo 
        LIMIT 1
    ");
    $stmt->execute([
        ':email'  => $email,
        ':pseudo' => $pseudo
    ]);

    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    error_log("Erreur SQL register (SELECT doublon): " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Impossible de créer le compte."]);
    exit;
}

if ($existing) {
    // Tentative "valide" mais email/pseudo déjà pris → on compte comme tentative
    try {
        if ($attempt) {
            $pdo->prepare("
                UPDATE register_attempts
                SET attempts = attempts + 1, last_attempt = NOW()
                WHERE ip = :ip
            ")->execute([':ip' => $ip]);
        } else {
            $pdo->prepare("
                INSERT INTO register_attempts (ip, attempts, last_attempt)
                VALUES (:ip, 1, NOW())
            ")->execute([':ip' => $ip]);
        }
    } catch (PDOException $e) {
        error_log("Erreur SQL register_attempts (update on duplicate): " . $e->getMessage());
    }

    http_response_code(409);
    echo json_encode(["success" => false, "message" => "Impossible de créer le compte."]);
    exit;
}

// ---------------------------------------------------------
// 7) Hash du mot de passe
// ---------------------------------------------------------
$hashedPassword = password_hash($password, PASSWORD_DEFAULT);

// ---------------------------------------------------------
// 8) Insertion SQL sécurisée
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

    // Succès → reset des tentatives register_attempts
    try {
        $pdo->prepare("
            DELETE FROM register_attempts 
            WHERE ip = :ip
        ")->execute([':ip' => $ip]);
    } catch (PDOException $e) {
        error_log("Erreur SQL register_attempts (reset on success): " . $e->getMessage());
    }

    http_response_code(201);
    echo json_encode(["success" => true, "message" => "Compte créé !"]);
    exit;

} catch (PDOException $e) {

    // En cas de race condition sur doublon, on reste neutre
    if (isset($e->errorInfo[1]) && $e->errorInfo[1] === 1062) {
        try {
            if ($attempt) {
                $pdo->prepare("
                    UPDATE register_attempts
                    SET attempts = attempts + 1, last_attempt = NOW()
                    WHERE ip = :ip
                ")->execute([':ip' => $ip]);
            } else {
                $pdo->prepare("
                    INSERT INTO register_attempts (ip, attempts, last_attempt)
                    VALUES (:ip, 1, NOW())
                ")->execute([':ip' => $ip]);
            }
        } catch (PDOException $e2) {
            error_log("Erreur SQL register_attempts (update on 1062): " . $e2->getMessage());
        }

        http_response_code(409);
        echo json_encode(["success" => false, "message" => "Impossible de créer le compte."]);
        exit;
    }

    error_log('Erreur register (INSERT): ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Impossible de créer le compte."]);
    exit;
}