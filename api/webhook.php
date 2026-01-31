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

if ($event->type === 'checkout.session.completed') {
    $session = $event->data->object;

    $userId = intval($session->metadata->user_id ?? 0);
    $parcId = intval($session->metadata->parc_id ?? 0);

    $stripeSessionId = $session->id ?? null;
    $stripePaymentIntent = $session->payment_intent ?? null;

    error_log("Webhook Stripe OK : user_id={$userId}, parc_id={$parcId}, session={$stripeSessionId}, intent={$stripePaymentIntent}");

    if ($userId > 0 && $parcId > 0) {
        $stmt = $pdo->prepare("
            INSERT INTO user_parc_payments 
                (user_id, parc_id, stripe_session_id, stripe_payment_intent, expires_at)
            VALUES 
                (:user_id, :parc_id, :session_id, :payment_intent, DATE_ADD(NOW(), INTERVAL 3 DAY))
            ON DUPLICATE KEY UPDATE
                stripe_session_id = VALUES(stripe_session_id),
                stripe_payment_intent = VALUES(stripe_payment_intent),
                expires_at = VALUES(expires_at)
        ");

        $stmt->execute([
            ':user_id' => $userId,
            ':parc_id' => $parcId,
            ':session_id' => $stripeSessionId,
            ':payment_intent' => $stripePaymentIntent
        ]);
    }
}

http_response_code(200);
