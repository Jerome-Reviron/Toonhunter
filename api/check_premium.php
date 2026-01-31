<?php
require_once __DIR__ . "/cors.php";
require_once __DIR__ . "/db.php";
require_once __DIR__ . "/auth.php";

header("Content-Type: application/json; charset=UTF-8");

// ---------------------------------------------------------
// 1) Vérification méthode HTTP
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Méthode non autorisée."]);
    exit;
}

// ---------------------------------------------------------
// 2) Vérification session utilisateur
// ---------------------------------------------------------
$userId = $_SESSION['user_id'] ?? 0;

if ($userId <= 0) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Utilisateur non connecté."]);
    exit;
}

// ---------------------------------------------------------
// 3) Récupération du parc_id depuis l’URL
// ---------------------------------------------------------
$parcId = isset($_GET['parc_id']) ? intval($_GET['parc_id']) : 0;

if ($parcId <= 0) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "parc_id invalide."]);
    exit;
}

// ---------------------------------------------------------
// 4) Vérification premium dans user_parc_payments
// ---------------------------------------------------------
try {
    $stmt = $pdo->prepare("
        SELECT 1
        FROM user_parc_payments
        WHERE user_id = :user_id
        AND parc_id = :parc_id
        AND expires_at > NOW()
        LIMIT 1
    ");

    $stmt->execute([
        ':user_id' => $userId,
        ':parc_id' => $parcId
    ]);

    $hasAccess = $stmt->fetchColumn() ? true : false;

} catch (PDOException $e) {
    error_log("Erreur SQL check_premium: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erreur interne."]);
    exit;
}

// ---------------------------------------------------------
// 5) Réponse finale
// ---------------------------------------------------------
echo json_encode([
    "success"   => true,
    "isPremium" => $hasAccess
]);
exit;
