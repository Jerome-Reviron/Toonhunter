<?php
// ---------------------------------------------------------
// forgot-password.php - Version blindée
// ---------------------------------------------------------

// ⚠️ À désactiver en production
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/cors.php";
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/vendor/autoload.php'; // PHPMailer

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

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
// 2) Lecture et validation du JSON
// ---------------------------------------------------------
$raw = file_get_contents("php://input");
$data = json_decode($raw);

if (!$data || empty($data->email)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Email requis."]);
    exit;
}

$email = trim($data->email);
$email = strtolower($email);
$email = filter_var($email, FILTER_SANITIZE_EMAIL);

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Email invalide."]);
    exit;
}

if (strlen($email) > 255) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Email trop long."]);
    exit;
}

// ---------------------------------------------------------
// 3) Récupération IP et protection anti-abus
// ---------------------------------------------------------
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

// Limite 1 : max 5 demandes par heure pour une même IP
try {
    $stmt = $pdo->prepare("
        SELECT COUNT(*) AS total 
        FROM password_resets 
        WHERE ip = :ip 
            AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
    ");
    $stmt->execute([':ip' => $ip]);
    $attempts = (int)$stmt->fetchColumn();

    if ($attempts >= 5) {
        http_response_code(429);
        echo json_encode([
            "success" => false,
            "message" => "Trop de tentatives. Réessayez plus tard."
        ]);
        exit;
    }
} catch (PDOException $e) {
    error_log("Erreur SQL forgot-password (rate limit IP): " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erreur interne."]);
    exit;
}

// ---------------------------------------------------------
// 4) Vérifie si l'utilisateur existe (mais sans le révéler)
// ---------------------------------------------------------
try {
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = :email LIMIT 1");
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    error_log("Erreur SQL forgot-password (select user): " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erreur interne."]);
    exit;
}

// On ne sort plus du script : on note juste si l'email existe $emailExists = (bool)$user;
$emailExists = (bool)$user;

// ---------------------------------------------------------
// 5) Anti-spam par email : 1 demande / 2 minutes
// ---------------------------------------------------------
try {
    $stmt = $pdo->prepare("
        SELECT created_at 
        FROM password_resets 
        WHERE email = :email 
        ORDER BY created_at DESC 
        LIMIT 1
    ");
    $stmt->execute([':email' => $email]);
    $lastRequest = $stmt->fetchColumn();

    // if ($lastRequest && strtotime($lastRequest) > time() - 120) {
    //     // Même réponse neutre : on ne dit pas si ça a vraiment été envoyé
    //     echo json_encode([
    //         "success" => true,
    //         "message" => "Si un compte existe, un email a été envoyé."
    //     ]);
    //     exit;
    // }
} catch (PDOException $e) {
    error_log("Erreur SQL forgot-password (last request): " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erreur interne."]);
    exit;
}

// ---------------------------------------------------------
// 6) Génération du code sécurisé
// ---------------------------------------------------------
try {
    $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
} catch (Exception $e) {
    error_log("Erreur génération code reset: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erreur interne."]);
    exit;
}

$expiresAt = date('Y-m-d H:i:s', time() + 900); // 15 minutes

// --------------------------------------------------------- 
// 7) Nettoyage des anciens codes expirés + insertion du nouveau 
// --------------------------------------------------------- 
    try { 
        // Supprime uniquement les codes expirés (propre, standard) 
        $stmt = $pdo->prepare(" 
        DELETE FROM password_resets 
        WHERE expires_at < NOW() 
    "); $stmt->execute(); 

    error_log("DEBUG RESET: insertion pour $email depuis IP $ip");

    // Enregistre le nouveau code (même si l'email n'existe pas) 
    $stmt = $pdo->prepare(" 
        INSERT INTO password_resets (email, token, expires_at, ip, created_at) 
        VALUES (:email, :token, :expires, :ip, NOW()) 
    "); 
    $stmt->execute([ 
        ':email' => $email, 
        ':token' => $code, 
        ':expires' => $expiresAt, 
        ':ip' => $ip 
    ]); 
} catch (PDOException $e) { 
    error_log("Erreur SQL forgot-password (insert reset): " . $e->getMessage()); 
    http_response_code(500); 
    echo json_encode(["success" => false, "message" => "Erreur interne."]); 
    exit; 
}

// ---------------------------------------------------------
// 8) Si l'email n'existe pas : réponse neutre après comptage de la tentative
// ---------------------------------------------------------
if (!$emailExists) {
    echo json_encode([
        "success" => true,
        "message" => "Si un compte existe, un email a été envoyé."
    ]);
    exit;
}

// ---------------------------------------------------------
// 9) Mode local : pas d'email réel, on renvoie le code en debug
// ---------------------------------------------------------
if ($_SERVER['SERVER_NAME'] === 'localhost') {
    echo json_encode([
        "success" => true,
        "message" => "Code généré (mode local).",
        "debug"   => $code // ⚠️ À retirer en production
    ]);
    exit;
}

// ---------------------------------------------------------
// 10) Mode production : envoi réel via PHPMailer (Hostinger)
// ---------------------------------------------------------
$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host       = 'smtp.hostinger.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'ton-email@tondomaine.com'; // ex: contact@toonhunter.fr
    $mail->Password   = 'TON_MOT_DE_PASSE_SMTP';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; // SSL
    $mail->Port       = 465;

    $mail->setFrom('noreply@tondomaine.com', 'ToonHunter');
    $mail->addAddress($email);

    $mail->isHTML(true);
    $mail->Subject = 'Votre code de réinitialisation';
    $mail->Body    = "
        <p>Voici votre code de réinitialisation :</p>
        <h2 style='font-size:32px; letter-spacing:4px;'>$code</h2>
        <p>Ce code expire dans 15 minutes.</p>
    ";

    $mail->send();

    echo json_encode([
        "success" => true,
        "message" => "Si un compte existe, un email a été envoyé."
    ]);
    exit;

} catch (Exception $e) {
    error_log("Erreur PHPMailer : " . $mail->ErrorInfo);
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Impossible d'envoyer l'email."
    ]);
    exit;
}
