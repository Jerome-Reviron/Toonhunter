<?php
require_once __DIR__ . "/cors.php";
require_once __DIR__ . "/db.php";

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
// 2) Récupération sécurisée du user_id
// ---------------------------------------------------------
$userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "user_id invalide"]);
    return;
}

// ---------------------------------------------------------
// 3) Récupération des infos utilisateur
// ---------------------------------------------------------
try {
    $stmt = $pdo->prepare("
        SELECT id, pseudo, email, role, isPaid 
        FROM users 
        WHERE id = :id
        LIMIT 1
    ");
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Utilisateur introuvable"]);
        return;
    }

    // ---------------------------------------------------------
    // 4) Normalisation des données
    // ---------------------------------------------------------

    // Normalisation isPaid
    $user['isPaid'] = ($user['isPaid'] == 1) ? 1 : 0;

    // Normalisation du rôle
    $roleFromDb = $user['role'] ?? 'user';
    $user['role'] = ($roleFromDb === 'admin') ? 'admin' : 'user';

    // ---------------------------------------------------------
    // 5) Réponse finale
    // ---------------------------------------------------------
    echo json_encode([
        "success" => true,
        "user" => $user
    ]);
    return;

} catch (PDOException $e) {
    error_log("Erreur SQL get_user_refresh: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erreur interne"]);
    return;
}
