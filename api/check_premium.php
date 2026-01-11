<?php
require_once __DIR__ . "/cors.php";
require_once __DIR__ . "/db.php";

header("Content-Type: application/json; charset=UTF-8");

$userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "user_id invalide."]);
    return;
}

try {
    $stmt = $pdo->prepare("SELECT isPaid FROM users WHERE id = :id LIMIT 1");
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch();
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

echo json_encode([
    "success" => true,
    "isPaid" => intval($user['isPaid']) // 0 ou 1
]);
