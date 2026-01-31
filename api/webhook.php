<?php
require_once __DIR__ . '/vendor/stripe/stripe-php/init.php';
require_once __DIR__ . '/db.php';

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

if ($event->type !== 'checkout.session.completed') { http_response_code(200); exit; }

if ($event->type === 'checkout.session.completed') {
    $session = $event->data->object;

    $userId = intval($session->metadata->user_id ?? 0);
    $parcId = intval($session->metadata->parc_id ?? 0);

    $stripeSessionId = $session->id ?? null;
    $stripePaymentIntent = $session->payment_intent ?? null;

    // 🔥 Récupération du price_id utilisé
    $priceId = $session->metadata->price_id ?? null;
    if (!$priceId) { error_log("❌ Pas de price_id dans metadata"); }

    // 🔥 Récupération des metadata du prix Stripe
    $price = \Stripe\Price::retrieve($priceId);

    // 🔥 Durée dynamique (fallback = 3 jours)
    $durationDays = intval($price->metadata->duration_days ?? 3);

    // 🔥 Calcul de l'expiration
    $expiresAt = date('Y-m-d H:i:s', strtotime("+{$durationDays} days"));

    error_log("Webhook Stripe OK : user_id={$userId}, parc_id={$parcId}, duration={$durationDays}j");

    if ($userId > 0 && $parcId > 0) {
        $stmt = $pdo->prepare("
            INSERT INTO user_parc_payments 
                (user_id, parc_id, stripe_session_id, stripe_payment_intent, expires_at)
            VALUES 
                (:user_id, :parc_id, :session_id, :payment_intent, :expires_at)
            ON DUPLICATE KEY UPDATE
                stripe_session_id = VALUES(stripe_session_id),
                stripe_payment_intent = VALUES(stripe_payment_intent),
                expires_at = VALUES(expires_at)
        ");

        $stmt->execute([
            ':user_id' => $userId,
            ':parc_id' => $parcId,
            ':session_id' => $stripeSessionId,
            ':payment_intent' => $stripePaymentIntent,
            ':expires_at' => $expiresAt
        ]);
    }
}

http_response_code(200);
