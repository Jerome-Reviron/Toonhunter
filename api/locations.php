<?php
/* 
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->query("SELECT * FROM locations");
    $locations = $stmt->fetchAll();
    
    // Formattage pour React (on transforme latitude/longitude en objet coordinates)
    foreach ($locations as &$loc) {
        $loc['coordinates'] = [
            'latitude' => (float)$loc['latitude'],
            'longitude' => (float)$loc['longitude']
        ];
        $loc['radiusMeters'] = (int)$loc['radiusMeters'];
    }
    echo json_encode($locations);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents("php://input"));
    $stmt = $pdo->prepare("INSERT INTO locations (name, characterName, latitude, longitude, radiusMeters, promptContext, imageUrl, rarity, validationKeywords) VALUES (?,?,?,?,?,?,?,?,?)");
    $stmt->execute([
        $data->name, $data->characterName, $data->coordinates->latitude, 
        $data->coordinates->longitude, $data->radiusMeters, $data->promptContext, 
        $data->imageUrl, $data->rarity, $data->validationKeywords
    ]);
    echo json_encode(["success" => true, "id" => $pdo->lastInsertId()]);
}
*/


// ---------------------------------------------------------
// Version sécurisée et optimisée
// ---------------------------------------------------------

require_once __DIR__ . '/db.php';

header("Content-Type: application/json; charset=UTF-8");

// ---------------------------------------------------------
// GET : récupérer toutes les locations
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    try {
        $stmt = $pdo->query("SELECT * FROM locations");
        $locations = $stmt->fetchAll();
    } catch (PDOException $e) {
        error_log("Erreur SQL GET locations: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erreur interne."]);
        return;
    }

    foreach ($locations as &$loc) {
        $loc['coordinates'] = [
            'latitude'  => isset($loc['latitude'])  ? (float)$loc['latitude']  : null,
            'longitude' => isset($loc['longitude']) ? (float)$loc['longitude'] : null,
        ];
        $loc['radiusMeters'] = isset($loc['radiusMeters']) ? (int)$loc['radiusMeters'] : 0;
    }

    echo json_encode(["success" => true, "locations" => $locations]);
    return;
}


// ---------------------------------------------------------
// POST : ajouter une nouvelle location
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $raw = file_get_contents("php://input");
    $data = json_decode($raw);

    if (!$data) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "JSON invalide."]);
        return;
    }

    $name          = trim($data->name ?? '');
    $characterName = trim($data->characterName ?? '');
    $lat           = $data->coordinates->latitude  ?? null;
    $lng           = $data->coordinates->longitude ?? null;
    $radius        = $data->radiusMeters ?? null;
    $promptContext = trim($data->promptContext ?? '');
    $imageUrl      = trim($data->imageUrl ?? '');
    $rarity        = trim($data->rarity ?? '');
    $validationKeywords = trim($data->validationKeywords ?? '');

    // Validation minimale
    if (
        $name === '' || $characterName === '' ||
        $lat === null || $lng === null || $radius === null
    ) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Données obligatoires manquantes."]);
        return;
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO locations 
                (name, characterName, latitude, longitude, radiusMeters, promptContext, imageUrl, rarity, validationKeywords) 
            VALUES 
                (:name, :characterName, :lat, :lng, :radius, :promptContext, :imageUrl, :rarity, :validationKeywords)
        ");

        $stmt->execute([
            ':name'              => $name,
            ':characterName'     => $characterName,
            ':lat'               => (float)$lat,
            ':lng'               => (float)$lng,
            ':radius'            => (int)$radius,
            ':promptContext'     => $promptContext,
            ':imageUrl'          => $imageUrl,
            ':rarity'            => $rarity,
            ':validationKeywords'=> $validationKeywords
        ]);

        echo json_encode([
            "success" => true,
            "id" => (int)$pdo->lastInsertId()
        ]);
        return;

    } catch (PDOException $e) {
        error_log("Erreur SQL POST locations: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erreur interne."]);
        return;
    }
}


// ---------------------------------------------------------
// Méthode non autorisée
// ---------------------------------------------------------
http_response_code(405);
echo json_encode(["success" => false, "message" => "Méthode non autorisée."]);
