<?php
error_log("REAL FILE = " . __FILE__);

require_once __DIR__ . "/cors.php";
require_once __DIR__ . "/db.php";

header("Content-Type: application/json; charset=UTF-8");

$uploadDir = rtrim(__DIR__, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . "uploads";
$publicPath = "/api/uploads/";

// Debug
error_log("UPLOAD DIR = " . $uploadDir);

// Créer le dossier si nécessaire
if (!file_exists($uploadDir)) {
    if (!mkdir($uploadDir, 0777, true)) {
        error_log("Impossible de créer le dossier uploads: " . $uploadDir);
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erreur serveur: impossible de créer le dossier uploads."]);
        exit;
    }
}

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

    $collection = [];
    foreach ($items as $item) {
        $collection[$item['locationId']] = [
            "locationId" => $item['locationId'],
            "photoUrl"   => $item['photoUrl'],
            "quote"      => $item['quote'],
            "capturedAt" => $item['capturedAt'],
        ];
    }

    echo json_encode(["success" => true, "collection" => $collection]);
    return;
}


// ---------------------------------------------------------
// POST : ajouter un trophée (avec sauvegarde fichier)
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
    $photoBase64 = $data->photoUrl ?? '';
    $quote      = trim($data->quote ?? '');

    if ($userId <= 0 || $locationId <= 0 || $photoBase64 === '') {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Données incomplètes."]);
        return;
    }

    // Extraction du base64
    if (strpos($photoBase64, "base64,") !== false) {
        $photoBase64 = explode("base64,", $photoBase64)[1];
    }

    $imageData = base64_decode($photoBase64);

    if (!$imageData) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Image invalide."]);
        return;
    }

    // Nom unique
    $fileName = "user_{$userId}_loc_{$locationId}_" . time() . ".jpg";
    $filePath = $uploadDir . $fileName;
    $publicUrl = $publicPath . $fileName;

    // Sauvegarde du fichier
    file_put_contents($filePath, $imageData);

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
            ':photoUrl'   => $publicUrl,
            ':quote'      => $quote
        ]);
    } catch (PDOException $e) {
        error_log("Erreur SQL POST collection: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erreur interne."]);
        return;
    }

    echo json_encode(["success" => true, "photoUrl" => $publicUrl]);
    return;
}


// ---------------------------------------------------------
// Méthode non autorisée
// ---------------------------------------------------------
http_response_code(405);
echo json_encode(["success" => false, "message" => "Méthode non autorisée."]);
