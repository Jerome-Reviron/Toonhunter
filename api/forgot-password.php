<?php
/* 
Ancienne version inexistante — ce fichier est nouveau.
*/

// ---------------------------------------------------------
// Version sécurisée : forgot-password.php
// ---------------------------------------------------------
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/cors.php";
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/vendor/autoload.php'; // PHPMailer

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

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

if (!$data || empty($data->email)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Email requis."]);
    exit;
}

$email = trim($data->email);

// Vérification email valide
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Email invalide."]);
    exit;
}

// Vérifie si l'utilisateur existe
$stmt = $pdo->prepare("SELECT id FROM users WHERE email = :email LIMIT 1");
$stmt->execute([':email' => $email]);
$user = $stmt->fetch();

if (!$user) {
    // Pour éviter de révéler si un email existe ou non
    echo json_encode(["success" => true, "message" => "Si un compte existe, un email a été envoyé."]);
    exit;
}

// Génère un code sécurisé à 6 chiffres
$code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
$expiresAt = date('Y-m-d H:i:s', time() + 900); // 15 minutes

// Supprime les anciens codes
$pdo->prepare("DELETE FROM password_resets WHERE email = :email")->execute([':email' => $email]);

// Enregistre le nouveau code
$stmt = $pdo->prepare("
    INSERT INTO password_resets (email, token, expires_at)
    VALUES (:email, :token, :expires)
");
$stmt->execute([
    ':email' => $email,
    ':token' => $code,
    ':expires' => $expiresAt
]);

// 🔍 Mode local : on ne tente pas d’envoyer l’email
if ($_SERVER['SERVER_NAME'] === 'localhost') {
    echo json_encode([
        "success" => true,
        "message" => "Code généré (mode local).",
        "debug" => $code // ⚠️ À retirer en production
    ]);
    exit;
}

// 🔐 Mode production : envoi réel via PHPMailer
$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host = 'smtp.hostinger.com'; // À adapter
    $mail->SMTPAuth = true;
    $mail->Username = 'ton-email@tondomaine.com'; // À adapter
    $mail->Password = 'TON_MOT_DE_PASSE_SMTP';     // À adapter
    $mail->SMTPSecure = 'tls';
    $mail->Port = 587;

    $mail->setFrom('noreply@tondomaine.com', 'ToonHunter'); // À adapter
    $mail->addAddress($email);

    $mail->isHTML(true);
    $mail->Subject = 'Votre code de réinitialisation';
    $mail->Body = "
        <p>Voici votre code de réinitialisation :</p>
        <h2 style='font-size:32px; letter-spacing:4px;'>$code</h2>
        <p>Ce code expire dans 15 minutes.</p>
    ";

    $mail->send();

    echo json_encode(["success" => true, "message" => "Code envoyé."]);
} catch (Exception $e) {
    error_log("Erreur PHPMailer : " . $mail->ErrorInfo);
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Impossible d'envoyer l'email."]);
}
