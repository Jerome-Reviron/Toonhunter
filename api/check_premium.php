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
    return;
}

// ---------------------------------------------------------
// 2) Récupération et validation du userId
// ---------------------------------------------------------
$userId = $_SESSION['user_id'];

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "userId invalide."]);
    return;
}

// ---------------------------------------------------------
// 3) Récupération en base
// ---------------------------------------------------------
try {
    $stmt = $pdo->prepare("
        SELECT isPaid
        FROM users
        WHERE id = :id
        LIMIT 1
    ");
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

} catch (PDOException $e) {
    error_log("Erreur SQL check_premium: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erreur interne."]);
    return;
}

if (!$user) {
    http_response_code(404);
    echo json_encode(["success" => false, "message" => "Utilisateur introuvable."]);
    return;
}

// ---------------------------------------------------------
// 4) Normalisation stricte de isPaid
// ---------------------------------------------------------
$isPaidValue = isset($user['isPaid']) ? intval($user['isPaid']) : 0;
$isPaidNormalized = ($isPaidValue === 1) ? 1 : 0;

// ---------------------------------------------------------
// 5) Réponse finale
// ---------------------------------------------------------
echo json_encode([
    "success" => true,
    "isPaid"  => $isPaidNormalized // toujours 0 ou 1
]);
