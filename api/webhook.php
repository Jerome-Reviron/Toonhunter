<?php
require_once __DIR__ . '/vendor/stripe/stripe-php/init.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/vendor/autoload.php'; // PHPMailer comme forgot-password

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

\Stripe\Stripe::setApiKey($_ENV['STRIPE_SECRET_KEY']);

$endpoint_secret = $_ENV['STRIPE_WHSEC'];

$payload = @file_get_contents('php://input');
$sig_header = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

try {
    $event = \Stripe\Webhook::constructEvent($payload, $sig_header, $endpoint_secret);
} catch (\UnexpectedValueException $e) {
    http_response_code(400);
    exit();
} catch (\Stripe\Exception\SignatureVerificationException $e) {
    http_response_code(400);
    exit();
}

if ($event->type !== 'checkout.session.completed') { 
    http_response_code(200); 
    exit; 
}

if ($event->type === 'checkout.session.completed') {

    $session = $event->data->object;

    $userId = intval($session->metadata->user_id ?? 0);
    $parcId = intval($session->metadata->parc_id ?? 0);

    $stripeSessionId = $session->id ?? null;
    $stripePaymentIntent = $session->payment_intent ?? null;

    // Montant total payé (en centimes)
    $amountCents = intval($session->amount_total ?? 0);

    // Récupération du price_id
    $priceId = $session->metadata->price_id ?? null;
    if (!$priceId) { error_log("❌ Pas de price_id dans metadata"); }

    // Récupération des metadata du prix Stripe
    $price = \Stripe\Price::retrieve($priceId);

    // Durée dynamique (fallback = 3 jours)
    $durationDays = intval($price->metadata->duration_days ?? 3);

    // Calcul expiration
    $expiresAt = date('Y-m-d H:i:s', strtotime("+{$durationDays} days"));

    error_log("Webhook Stripe OK : user_id={$userId}, parc_id={$parcId}, duration={$durationDays}j, amount={$amountCents}");

    if ($userId > 0 && $parcId > 0) {

        // INSERT / UPDATE avec amount_cents
        $stmt = $pdo->prepare("
            INSERT INTO user_parc_payments 
                (user_id, parc_id, stripe_session_id, stripe_payment_intent, expires_at, amount_cents)
            VALUES 
                (:user_id, :parc_id, :session_id, :payment_intent, :expires_at, :amount)
            ON DUPLICATE KEY UPDATE
                stripe_session_id = VALUES(stripe_session_id),
                stripe_payment_intent = VALUES(stripe_payment_intent),
                expires_at = VALUES(expires_at),
                amount_cents = VALUES(amount_cents)
        ");

        $stmt->execute([
            ':user_id' => $userId,
            ':parc_id' => $parcId,
            ':session_id' => $stripeSessionId,
            ':payment_intent' => $stripePaymentIntent,
            ':expires_at' => $expiresAt,
            ':amount' => $amountCents
        ]);

        // ---------------------------------------------------------
        //  EMAIL DE CONFIRMATION PREMIUM (PHPMailer)
        // ---------------------------------------------------------

        // Récupérer l'email utilisateur
        $stmtUser = $pdo->prepare("SELECT email FROM users WHERE id = :uid LIMIT 1");
        $stmtUser->execute([':uid' => $userId]);
        $user = $stmtUser->fetch(PDO::FETCH_ASSOC);

        // Récupérer le nom du parc 
        $stmtParc = $pdo->prepare("SELECT name FROM parcs WHERE id = :pid LIMIT 1"); 
        $stmtParc->execute([':pid' => $parcId]); 
        $parc = $stmtParc->fetch(PDO::FETCH_ASSOC); 
        $parcName = $parc['name'] ?? "Parc #$parcId"; 

        // Formater la date d'expiration 
        $expiresAtFormatted = date("d/m/Y H:i:s", strtotime($expiresAt));

        if ($user && !empty($user['email'])) {

            $mail = new PHPMailer(true);

            try {
                $mail->CharSet = 'UTF-8';
                $mail->Encoding = 'base64';

                // SMTP Hostinger (identique à forgot-password.php)
                $mail->isSMTP();
                $mail->Host       = $_ENV['SMTP_HOST'];
                $mail->SMTPAuth   = true;
                $mail->Username   = $_ENV['SMTP_USER'];
                $mail->Password   = $_ENV['SMTP_PASS'];
                $mail->Port       = (int)$_ENV['SMTP_PORT'];
                $mail->SMTPSecure = ($_ENV['SMTP_SECURE'] === 'ssl')
                    ? PHPMailer::ENCRYPTION_SMTPS 
                    : PHPMailer::ENCRYPTION_STARTTLS;

                // Expéditeur
                $mail->setFrom($_ENV['SMTP_USER'], 'ToonHunter');

                // Destinataire
                $mail->addAddress($user['email']);

                // Contenu HTML
                $mail->isHTML(true);
                $mail->Subject = "Votre accès premium est activé 🎉";

                $mail->Body = " <h2>Merci pour votre achat !</h2> 
                <p>Votre accès premium pour le parc <strong>{$parcName}</strong> est maintenant actif.</p> 
                <p><strong>Durée :</strong> {$durationDays} jours
                <br> <strong>Expiration :</strong> {$expiresAtFormatted}</p> 
                <p>Vous pouvez commencer à chasser les Toons et réaliser des photos pleines de magie.</p>
                <p>À très vite,<br>L'équipe ToonHunter</p> ";

                $mail->send();
                error_log("📧 Email premium envoyé à {$user['email']}");

            } catch (Exception $e) {
                error_log("❌ Erreur envoi email premium : " . $mail->ErrorInfo);
            }
        }
    }
}

http_response_code(200);
