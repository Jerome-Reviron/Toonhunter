<?php
error_log("REAL FILE = " . __FILE__);

require_once __DIR__ . "/cors.php";
require_once __DIR__ . "/db.php";

header("Content-Type: application/json; charset=UTF-8");

// ---------------------------------------------------------
// GET : récupérer la collection d’un utilisateur
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    error_log(">>> [Collection] Requête reçue");

    $userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

    if ($userId <= 0) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "user_id invalide."]);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT * FROM collection WHERE userId = :userId");
        $stmt->execute([':userId' => $userId]);
        $items = $stmt->fetchAll();
    } catch (PDOException $e) {
        error_log("Erreur SQL GET collection: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erreur interne."]);
        return;
    }

    $collection = [];
    foreach ($items as $item) {
        $collection[$item['locationId']] = [
            "id"         => $item['id'],
            "userId"     => $item['userId'],
            "locationId" => $item['locationId'],
            "photoUrl"   => $item['photoUrl'],
            "quote"      => $item['quote'],
            "capturedAt" => $item['capturedAt'],
        ];
    }

    error_log(">>> [Collection] Réponse envoyée");

    echo json_encode(["success" => true, "collection" => $collection]);
    return;
}


// ---------------------------------------------------------
// POST : ajouter un trophée (stockage base64 en BDD)
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $raw = file_get_contents("php://input");
    $data = json_decode($raw);

    if (!$data) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "JSON invalide."]);
        return;
    }

    $userId      = (int)($data->userId ?? 0);
    $locationId  = (int)($data->locationId ?? 0);
    $photoBase64 = $data->photoUrl ?? '';
    $quote       = trim($data->quote ?? '');

    if ($userId <= 0 || $locationId <= 0 || $photoBase64 === '') {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Données incomplètes."]);
        return;
    }

    // Nettoyage éventuel du base64
    if (strpos($photoBase64, "base64,") !== false) {
        $photoBase64 = explode("base64,", $photoBase64)[1];
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO collection (userId, locationId, photoUrl, quote, capturedAt)
            VALUES (:userId, :locationId, :photoUrl, :quote, NOW())
            ON DUPLICATE KEY UPDATE 
                photoUrl = VALUES(photoUrl),
                quote = VALUES(quote),
                capturedAt = NOW()
        ");

        $stmt->execute([
            ':userId'     => $userId,
            ':locationId' => $locationId,
            ':photoUrl'   => $photoBase64,
            ':quote'      => $quote
        ]);

        // Récupérer la ligne fraîchement insérée/mise à jour
        $stmt2 = $pdo->prepare("SELECT * FROM collection WHERE userId = :userId AND locationId = :locationId");
        $stmt2->execute([
            ':userId' => $userId,
            ':locationId' => $locationId
        ]);
        $item = $stmt2->fetch();

    } catch (PDOException $e) {
        error_log("Erreur SQL POST collection: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erreur interne."]);
        return;
    }

    echo json_encode([
        "success" => true,
        "item" => [
            "id"         => $item['id'],
            "userId"     => $item['userId'],
            "locationId" => $item['locationId'],
            "photoUrl"   => $item['photoUrl'],
            "quote"      => $item['quote'],
            "capturedAt" => $item['capturedAt'],
        ]
    ]);
    return;
}


// ---------------------------------------------------------
// Méthode non autorisée
// ---------------------------------------------------------
http_response_code(405);
echo json_encode(["success" => false, "message" => "Méthode non autorisée."]);
