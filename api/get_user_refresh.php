<?php
require_once __DIR__ . "/cors.php";
require_once __DIR__ . "/db.php";

header("Content-Type: application/json");

$userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

if ($userId <= 0) {
    echo json_encode(["success" => false, "message" => "user_id invalide"]);
    return;
}

try {
    $stmt = $pdo->prepare("SELECT id, email, isPaid FROM users WHERE id = :id");
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch();

    if (!$user) {
        echo json_encode(["success" => false, "message" => "Utilisateur introuvable"]);
        return;
    }

    echo json_encode([
        "success" => true,
        "user" => $user
    ]);
} catch (PDOException $e) {
    error_log("Erreur SQL get_user_refresh: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "Erreur interne"]);
}
