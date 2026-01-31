<?php

require_once __DIR__ . "/cors.php";
require_once __DIR__ . "/auth.php";
require_once __DIR__ . "/db.php";
require_once __DIR__ . "/vendor/autoload.php";

header("Content-Type: application/json; charset=UTF-8");

// ---------------------------------------------------------
// 1) Vérifier méthode HTTP
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Méthode non autorisée."]);
    exit;
}

// ---------------------------------------------------------
// 2) Lire JSON
// ---------------------------------------------------------
$raw = file_get_contents("php://input");
$data = json_decode($raw);

if (!$data || !isset($data->parc_id)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "parc_id manquant."]);
    exit;
}

$parcId = intval($data->parc_id);
if ($parcId <= 0) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "parc_id invalide."]);
    exit;
}

// ---------------------------------------------------------
// 3) Vérifier utilisateur connecté
// ---------------------------------------------------------
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Utilisateur non authentifié."]);
    exit;
}

$userId = intval($_SESSION['user_id']);

// ---------------------------------------------------------
// 4) Vérifier que le parc existe + récupérer stripe_price_id
// ---------------------------------------------------------
try {
    $stmt = $pdo->prepare("
        SELECT id, name, stripe_price_id 
        FROM parcs 
        WHERE id = :pid 
        LIMIT 1
    ");
    $stmt->execute([':pid' => $parcId]);
    $parc = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$parc) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Parc introuvable."]);
        exit;
    }

    if (empty($parc['stripe_price_id'])) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "stripe_price_id manquant pour ce parc."]);
        exit;
    }

    $priceId = $parc['stripe_price_id'];

} catch (PDOException $e) {
    error_log("Erreur SQL vérification parc: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erreur interne."]);
    exit;
}

// ---------------------------------------------------------
// 5) Vérifier si l'utilisateur a déjà un accès actif (< 3 jours)
// ---------------------------------------------------------
try {
    $stmt = $pdo->prepare("
        SELECT id FROM user_parc_payments
        WHERE user_id = :uid
        AND parc_id = :pid
        AND expires_at > NOW()
        LIMIT 1
    ");
    $stmt->execute([
        ':uid' => $userId,
        ':pid' => $parcId
    ]);

    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        echo json_encode([
            "success" => true,
            "alreadyPaid" => true,
            "message" => "Accès déjà actif pour ce parc."
        ]);
        exit;
    }
} catch (PDOException $e) {
    error_log("Erreur SQL vérification paiement actif: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erreur interne."]);
    exit;
}

// ---------------------------------------------------------
// 6) Créer la session Stripe Checkout (avec price_id)
// ---------------------------------------------------------
\Stripe\Stripe::setApiKey($_ENV['STRIPE_SECRET_KEY']);

try {
    $session = \Stripe\Checkout\Session::create([
        'mode' => 'payment',
        'payment_method_types' => ['card'],

        'line_items' => [[
            'price' => $priceId,
            'quantity' => 1,
        ]],

        'metadata' => [
            'user_id' => $_SESSION['user_id'],
            'parc_id' => $parcId
        ],

    'success_url' => "https://192.168.1.100:5173/?payment=success",
    'cancel_url'  => "https://192.168.1.100:5173/?payment=cancel",
    ]);

    echo json_encode([
        "success" => true,
        "url" => $session->url
    ]);
    exit;

} catch (Exception $e) {
    error_log("Erreur Stripe Checkout: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erreur Stripe."]);
    exit;
}
