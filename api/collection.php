<?php
/* 
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $userId = $_GET['user_id'] ?? 0;
    $stmt = $pdo->prepare("SELECT * FROM collection WHERE userId = ?");
    $stmt->execute([$userId]);
    $items = $stmt->fetchAll();
    
    $collection = [];
    foreach ($items as $item) {
        $collection[$item['locationId']] = $item;
    }
    echo json_encode(["collection" => $collection]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents("php://input"));
    $stmt = $pdo->prepare("INSERT INTO collection (userId, locationId, photoUrl, quote) VALUES (?, ?, ?, ?)");
    $stmt->execute([$data->userId, $data->locationId, $data->photoUrl, $data->quote]);
    echo json_encode(["success" => true]);
}
*/


// ---------------------------------------------------------
// Version sécurisée et optimisée
// ---------------------------------------------------------

require_once __DIR__ . '/db.php';

header("Content-Type: application/json; charset=UTF-8");


// ---------------------------------------------------------
// GET : récupérer la collection d’un utilisateur
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

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

    // Formatage : indexer par locationId
    $collection = [];
    foreach ($items as $item) {
        $collection[$item['locationId']] = $item;
    }

    echo json_encode(["success" => true, "collection" => $collection]);
    return;
}


// ---------------------------------------------------------
// POST : ajouter un élément à la collection
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $raw = file_get_contents("php://input");
    $data = json_decode($raw);

    if (!$data) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "JSON invalide."]);
        return;
    }

    $userId     = (int)($data->userId ?? 0);
    $locationId = (int)($data->locationId ?? 0);
    $photoUrl   = trim($data->photoUrl ?? '');
    $quote      = trim($data->quote ?? '');

    if ($userId <= 0 || $locationId <= 0 || $photoUrl === '') {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Données incomplètes ou invalides."]);
        return;
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO collection (userId, locationId, photoUrl, quote) 
            VALUES (:userId, :locationId, :photoUrl, :quote)
        ");

        $stmt->execute([
            ':userId'     => $userId,
            ':locationId' => $locationId,
            ':photoUrl'   => $photoUrl,
            ':quote'      => $quote
        ]);
    } catch (PDOException $e) {
        error_log("Erreur SQL POST collection: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erreur interne."]);
        return;
    }

    echo json_encode(["success" => true]);
    return;
}


// ---------------------------------------------------------
// Méthode non autorisée
// ---------------------------------------------------------
http_response_code(405);
echo json_encode(["success" => false, "message" => "Méthode non autorisée."]);
