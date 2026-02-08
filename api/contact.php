<?php
// ---------------------------------------------------------
// contact.php - Formulaire de contact sécurisé (multipart)
// ---------------------------------------------------------

require_once __DIR__ . "/cors.php";
require_once __DIR__ . "/auth.php"; // Vérifie la session utilisateur
require_once __DIR__ . "/vendor/autoload.php"; // PHPMailer
require_once __DIR__ . "/db.php";

session_start();

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

header("Content-Type: application/json; charset=UTF-8");

// ---------------------------------------------------------
// 1) Vérification méthode HTTP
// ---------------------------------------------------------
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Méthode non autorisée."]);
    exit;
}

// ---------------------------------------------------------
// 2) Vérification session utilisateur
// ---------------------------------------------------------
if (!isset($_SESSION["user_id"]) || !isset($_SESSION["email"])) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Non autorisé."]);
    exit;
}

$userEmail = $_SESSION["email"];

// ---------------------------------------------------------
// 3) Validation des champs
// ---------------------------------------------------------
$subject = trim($_POST["subject"] ?? "");
$message = trim($_POST["message"] ?? "");

if ($subject === "" || $message === "") {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Sujet et message obligatoires."]);
    exit;
}

// ---------------------------------------------------------
// 4) Gestion de la pièce jointe (optionnelle)
// ---------------------------------------------------------
$attachmentPath = null;
$attachmentName = null;

if (!empty($_FILES["screenshot"]["tmp_name"])) {
    $file = $_FILES["screenshot"];

    // Vérification basique
    if ($file["error"] === UPLOAD_ERR_OK) {
        $allowed = ["image/jpeg", "image/png", "image/webp"];
        if (in_array($file["type"], $allowed)) {
            $attachmentPath = $file["tmp_name"];
            $attachmentName = $file["name"];
        }
    }
}

// ---------------------------------------------------------
// 5) Envoi de l’email à contact@toonhunter.fr
// ---------------------------------------------------------
$mail = new PHPMailer(true);

try {
    $mail->CharSet = "UTF-8";
    $mail->Encoding = "base64";
    $mail->isSMTP();
    $mail->Host       = $_ENV["SMTP_HOST"];
    $mail->SMTPAuth   = true;
    $mail->Username   = $_ENV["SMTP_USER"];
    $mail->Password   = $_ENV["SMTP_PASS"];
    $mail->Port       = (int)$_ENV["SMTP_PORT"];
    $mail->SMTPSecure = ($_ENV["SMTP_SECURE"] === "ssl")
        ? PHPMailer::ENCRYPTION_SMTPS
        : PHPMailer::ENCRYPTION_STARTTLS;

    $mail->setFrom($_ENV["SMTP_USER"], "ToonHunter");
    $mail->addAddress("contact@toonhunter.fr");

    if ($attachmentPath) {
        $mail->addAttachment($attachmentPath, $attachmentName);
    }

    $mail->isHTML(false); // TEXTE BRUT
    $mail->Subject = "📩 Nouveau message de contact";
    $mail->Body =
"Un utilisateur vous a envoyé un message via ToonHunter.

Email : $userEmail

Sujet :
$subject

Message :
$message

-- 
ToonHunter";

    $mail->send();

} catch (Exception $e) {
    error_log("Erreur PHPMailer contact.php : " . $mail->ErrorInfo);
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Impossible d'envoyer le message."]);
    exit;
}

// ---------------------------------------------------------
// 6) Email de confirmation à l’utilisateur
// ---------------------------------------------------------
try {
    $confirm = new PHPMailer(true);

    $confirm->CharSet = "UTF-8";
    $confirm->Encoding = "base64";
    $confirm->isSMTP();
    $confirm->Host       = $_ENV["SMTP_HOST"];
    $confirm->SMTPAuth   = true;
    $confirm->Username   = $_ENV["SMTP_USER"];
    $confirm->Password   = $_ENV["SMTP_PASS"];
    $confirm->Port       = (int)$_ENV["SMTP_PORT"];
    $confirm->SMTPSecure = ($_ENV["SMTP_SECURE"] === "ssl")
        ? PHPMailer::ENCRYPTION_SMTPS
        : PHPMailer::ENCRYPTION_STARTTLS;

    $confirm->setFrom($_ENV["SMTP_USER"], "ToonHunter");
    $confirm->addAddress($userEmail);

    $confirm->isHTML(false);
    $confirm->Subject = "Votre message a bien été reçu";
    $confirm->Body =
"Madame, Monsieur,

Nous vous confirmons la bonne réception de votre message. 
Notre équipe vous répondra dans les plus brefs délais.

Sujet :
$subject

Message envoyé :
$message

-- 
ToonHunter";

    $confirm->send();

} catch (Exception $e) {
    error_log("Erreur PHPMailer confirmation contact.php : " . $confirm->ErrorInfo);
    // On ne bloque pas l’utilisateur si la confirmation échoue
}

// ---------------------------------------------------------
// 7) Réponse finale
// ---------------------------------------------------------
echo json_encode(["success" => true, "message" => "Message envoyé avec succès."]);
exit;
