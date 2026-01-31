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
// 2) Récupération sécurisée du userId
// ---------------------------------------------------------
$userId = $_SESSION['user_id'] ?? 0;

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "userId invalide"]);
    exit;
}

// ---------------------------------------------------------
// 3) Récupération des infos utilisateur
// ---------------------------------------------------------
try {
    $stmt = $pdo->prepare("
        SELECT id, pseudo, email, role
        FROM users 
        WHERE id = :id
        LIMIT 1
    ");
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Utilisateur introuvable"]);
        exit;
    }

    // ---------------------------------------------------------
    // 4) Normalisation du rôle
    // ---------------------------------------------------------
    $roleFromDb = $user['role'] ?? 'user';
    $user['role'] = ($roleFromDb === 'admin') ? 'admin' : 'user';

    // ---------------------------------------------------------
    // 5) Réponse finale
    // ---------------------------------------------------------
    echo json_encode([
        "success" => true,
        "user" => $user
    ]);
    exit;

} catch (PDOException $e) {
    error_log("Erreur SQL get_user_refresh: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erreur interne"]);
    exit;
}
