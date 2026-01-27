<?php
error_log("REAL FILE = " . __FILE__);
error_log(">>> [Collection] Fichier exécuté : " . __FILE__);

require_once __DIR__ . "/cors.php";
require_once __DIR__ . "/db.php";
require_once __DIR__ . "/auth.php"; 

header("Content-Type: application/json; charset=UTF-8");

// ---------------------------------------------------------
// GET : récupérer la collection d’un utilisateur
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    error_log(">>> [Collection] GET reçu");

    // Harmonisation : userId (comme dans locations.php)
    $userId = $_SESSION['user_id'];

    if ($userId <= 0) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "userId invalide."]);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT * FROM collection WHERE userId = :userId");
        $stmt->execute([':userId' => $userId]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        error_log("Erreur SQL GET collection: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erreur interne."]);
        return;
    }

    $collection = [];
    foreach ($items as $item) {
        $collection[$item['locationId']] = [
            "id"         => (int)$item['id'],
            "userId"     => (int)$item['userId'],
            "locationId" => (int)$item['locationId'],
            "photoUrl"   => $item['photoUrl'],
            "quote"      => $item['quote'],
            "capturedAt" => $item['capturedAt'],
        ];
    }

    echo json_encode(["success" => true, "collection" => $collection]);
    return;
}

// // ---------------------------------------------------------
// // POST : désactivé
// // ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    error_log(">>> [Collection] POST désactivé pour test");
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "POST désactivé"]);
    return;
}

// ---------------------------------------------------------
// Méthode non autorisée
// ---------------------------------------------------------
http_response_code(405);
echo json_encode(["success" => false, "message" => "Méthode non autorisée."]);
