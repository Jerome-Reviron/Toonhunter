<?php

require_once __DIR__ . "/cors.php";
require_once __DIR__ . '/db.php';

header("Content-Type: application/json; charset=UTF-8");
// Autoriser les requêtes CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Répondre à la requête OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}



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
    $description   = trim($data->description ?? '');
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
                (name, description, characterName, latitude, longitude, radiusMeters, promptContext, imageUrl, rarity, validationKeywords) 
            VALUES 
                (:name, :description, :characterName, :lat, :lng, :radius, :promptContext, :imageUrl, :rarity, :validationKeywords)
        ");

        $stmt->execute([
            ':name'              => $name,
            ':description'       => $description,
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
// PUT : mettre à jour une location existante
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {

    $data = json_decode(file_get_contents("php://input"));

    if (!$data || !isset($data->id)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "ID manquant."]);
        return;
    }

    try {
        $stmt = $pdo->prepare("
            UPDATE locations SET
                name = :name,
                description = :description,
                characterName = :characterName,
                latitude = :lat,
                longitude = :lng,
                radiusMeters = :radius,
                promptContext = :promptContext,
                imageUrl = :imageUrl,
                rarity = :rarity,
                validationKeywords = :validationKeywords
            WHERE id = :id
        ");

        $stmt->execute([
            ':id'                => $data->id,
            ':name'              => $data->name,
            ':description'       => $data->description,
            ':characterName'     => $data->characterName,
            ':lat'               => $data->coordinates->latitude,
            ':lng'               => $data->coordinates->longitude,
            ':radius'            => $data->radiusMeters,
            ':promptContext'     => $data->promptContext,
            ':imageUrl'          => $data->imageUrl,
            ':rarity'            => $data->rarity,
            ':validationKeywords'=> $data->validationKeywords
        ]);

        echo json_encode(["success" => true]);
        return;

    } catch (PDOException $e) {
        error_log("Erreur SQL PUT locations: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erreur interne."]);
        return;
    }
}



// ---------------------------------------------------------
// DELETE : supprimer une location
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {

    parse_str($_SERVER['QUERY_STRING'], $query);

    if (!isset($query['id'])) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "ID manquant."]);
        return;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM locations WHERE id = :id");
        $stmt->execute([':id' => $query['id']]);

        echo json_encode(["success" => true]);
        return;

    } catch (PDOException $e) {
        error_log("Erreur SQL DELETE locations: " . $e->getMessage());
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

