<?php

require_once __DIR__ . "/cors.php";
require_once __DIR__ . '/db.php';
require_once __DIR__ . "/auth.php";

header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ---------------------------------------------------------
// GET : récupérer les locations (PUBLIC + filtrage par parc)
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    error_log(">>> [Location] GET reçu");

    try {
        if (isset($_GET['parc_id']) && $_GET['parc_id'] !== "") {

            $pid = intval($_GET['parc_id']);

            if ($pid <= 0) {
                http_response_code(400);
                echo json_encode(["success" => false, "message" => "parc_id invalide."]);
                return;
            }

            // 🔥 Renvoyer uniquement les locations du parc
            $stmt = $pdo->prepare("SELECT * FROM locations WHERE parc_id = :pid");
            $stmt->execute([':pid' => $pid]);

        } else {
            // 🔥 Aucun parc sélectionné → renvoyer TOUTES les locations
            $stmt = $pdo->query("SELECT * FROM locations");
        }

        $locations = $stmt->fetchAll(PDO::FETCH_ASSOC);

    } catch (PDOException $e) {
        error_log("Erreur SQL GET locations: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erreur interne."]);
        return;
    }

    // Normalisation…
    foreach ($locations as &$loc) {
        $loc['coordinates'] = [
            'latitude'  => isset($loc['latitude'])  ? (float)$loc['latitude']  : null,
            'longitude' => isset($loc['longitude']) ? (float)$loc['longitude'] : null,
        ];
        $loc['radiusMeters'] = isset($loc['radiusMeters']) ? (int)$loc['radiusMeters'] : 0;
        $loc['free'] = isset($loc['free']) ? (bool)$loc['free'] : false;

        // ---------------------------------------------------------
        // 🔥 Calcul hasAccess par parc
        // ---------------------------------------------------------
        $loc['hasAccess'] = false;

        // Gratuit → accès direct
        if (!empty($loc['free'])) {
            $loc['hasAccess'] = true;
        } else {
            // Si user connecté → vérifier paiement actif
            if (isset($_SESSION['user_id'])) {
                $uid = intval($_SESSION['user_id']);
                $pid = intval($loc['parc_id']);

                try {
                    $stmt2 = $pdo->prepare("
                        SELECT id FROM user_parc_payments
                        WHERE user_id = :uid
                        AND parc_id = :pid
                        AND expires_at > NOW()
                        LIMIT 1
                    ");
                    $stmt2->execute([
                        ':uid' => $uid,
                        ':pid' => $pid
                    ]);

                    if ($stmt2->fetch(PDO::FETCH_ASSOC)) {
                        $loc['hasAccess'] = true;
                    }
                } catch (PDOException $e) {
                    error_log("Erreur SQL hasAccess: " . $e->getMessage());
                }
            }
        }
    }

    error_log(">>> [Location] GET terminé, " . count($locations) . " lieux renvoyés");

    echo json_encode(["success" => true, "locations" => $locations]);
    return;
}

// ---------------------------------------------------------
// 🔒 Fonction : vérifier si un userId est admin (VERSION BLINDÉE)
// ---------------------------------------------------------
function requireAdmin(PDO $pdo, $userId)
{
    // 1) Vérification userId valide
    $userId = intval($userId);
    if ($userId <= 0) {
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Utilisateur non authentifié."
        ]);
        exit;
    }

    try {
        // 2) Vérification en base
        $stmt = $pdo->prepare("SELECT role FROM users WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        error_log("Erreur SQL requireAdmin: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Erreur interne."
        ]);
        exit;
    }

    // 3) Aucun utilisateur trouvé
    if (!$user) {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "Accès refusé."
        ]);
        exit;
    }

    // 4) Vérification du rôle
    $role = strtolower(trim($user['role']));
    if ($role !== 'admin') {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "Accès refusé : droits administrateur requis."
        ]);
        exit;
    }

    return true;
}

// ---------------------------------------------------------
// POST : ajouter une nouvelle location (ADMIN ONLY)
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 🔵 AJOUT : protection session + auth 
    require_once __DIR__ . "/auth.php";

    $raw = file_get_contents("php://input");
    $data = json_decode($raw);

    if (!$data) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "JSON invalide."]);
        return;
    }

    // 🔒 Vérification admin
    $userId = $_SESSION['user_id']; 
    requireAdmin($pdo, $userId);

    // 🔥 Lecture des champs EXACTEMENT comme ton JSON POST
    $name          = trim($data->name ?? '');
    $description   = trim($data->description ?? '');
    $characterName = trim($data->characterName ?? '');

    // 🔥 Coordinates (format officiel)
    $lat = isset($data->coordinates->latitude) ? (float)$data->coordinates->latitude : null;
    $lng = isset($data->coordinates->longitude) ? (float)$data->coordinates->longitude : null;

    // 🔥 radiusMeters
    $radius        = isset($data->radiusMeters) ? (int)$data->radiusMeters : null;

    $promptContext = trim($data->promptContext ?? '');
    $imageUrl      = trim($data->imageUrl ?? '');
    $rarity        = trim($data->rarity ?? '');
    $validationKeywords = trim($data->validationKeywords ?? '');
    $free = isset($data->free) ? (int)$data->free : 0;
    $parcId = isset($data->parc_id) && $data->parc_id !== "" ? intval($data->parc_id) : null;

    // 🔥 Validation stricte
    if ($name === '' || $characterName === '' || $lat === null || $lng === null || $radius === null) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Données obligatoires manquantes."]);
        return;
    }

    if ($parcId !== null && $parcId <= 0) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "parc_id invalide."]);
        return;
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO locations 
                (name, description, characterName, latitude, longitude, radiusMeters, promptContext, imageUrl, rarity, validationKeywords, free, parc_id) 
            VALUES 
                (:name, :description, :characterName, :lat, :lng, :radius, :promptContext, :imageUrl, :rarity, :validationKeywords, :free, :parc_id)
        ");

        $stmt->execute([
            ':name'              => $name,
            ':description'       => $description,
            ':characterName'     => $characterName,
            ':lat'               => $lat,
            ':lng'               => $lng,
            ':radius'            => $radius,
            ':promptContext'     => $promptContext,
            ':imageUrl'          => $imageUrl,
            ':rarity'            => $rarity,
            ':validationKeywords'=> $validationKeywords,
            ':free' => $free,
            ':parc_id' => $parcId
        ]);

        echo json_encode(["success" => true, "id" => (int)$pdo->lastInsertId()]);
        return;

    } catch (PDOException $e) {
        error_log("Erreur SQL POST locations: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erreur interne."]);
        return;
    }
}

// ---------------------------------------------------------
// PUT : mettre à jour une location existante (ADMIN ONLY)
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    // 🔵 AJOUT : protection session + auth 
    require_once __DIR__ . "/auth.php";

    $raw = file_get_contents("php://input");
    $data = json_decode($raw);

    if (!$data || !isset($data->id)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "ID manquant."]);
        return;
    }

    // 🔒 Vérification admin
    $userId = $_SESSION['user_id']; 
    requireAdmin($pdo, $userId);

    // 🔥 Lecture EXACTE selon ton JSON POST/PUT
    $name          = trim($data->name ?? '');
    $description   = trim($data->description ?? '');
    $characterName = trim($data->characterName ?? '');

    // 🔥 Coordinates (format officiel)
    $lat = isset($data->coordinates->latitude) ? (float)$data->coordinates->latitude : null;
    $lng = isset($data->coordinates->longitude) ? (float)$data->coordinates->longitude : null;

    $radius        = isset($data->radiusMeters) ? (int)$data->radiusMeters : null;
    $promptContext = trim($data->promptContext ?? '');
    $imageUrl      = trim($data->imageUrl ?? '');
    $rarity        = trim($data->rarity ?? '');
    $validationKeywords = trim($data->validationKeywords ?? '');
    $free = isset($data->free) ? (int)$data->free : 0;
    $parcId = isset($data->parc_id) && $data->parc_id !== "" ? intval($data->parc_id) : null;

    // 🔥 Validation stricte
    if ($name === '' || $characterName === '' || $lat === null || $lng === null || $radius === null) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Données obligatoires manquantes."]);
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
                validationKeywords = :validationKeywords,
                free = :free,
                parc_id = :parc_id
            WHERE id = :id
        ");

        $stmt->execute([
            ':id'                => $data->id,
            ':name'              => $name,
            ':description'       => $description,
            ':characterName'     => $characterName,
            ':lat'               => $lat,
            ':lng'               => $lng,
            ':radius'            => $radius,
            ':promptContext'     => $promptContext,
            ':imageUrl'          => $imageUrl,
            ':rarity'            => $rarity,
            ':validationKeywords'=> $validationKeywords,
            ':free'              => $free, 
            ':parc_id'           => $parcId
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
// DELETE : supprimer une location (ADMIN ONLY)
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    // 🔵 AJOUT : protection session + auth 
    require_once __DIR__ . "/auth.php";

    // Lecture du JSON envoyé par le frontend
    $raw = file_get_contents("php://input");
    $data = json_decode($raw);

    // Vérification ID
    if (!$data || !isset($data->id)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "ID manquant."]);
        return;
    }

    // 🔒 Vérification admin (même logique que POST et PUT)
    $userId = $_SESSION['user_id']; 
    requireAdmin($pdo, $userId);

    $id = intval($data->id);

    try {
        $stmt = $pdo->prepare("DELETE FROM locations WHERE id = :id");
        $stmt->execute([':id' => $id]);

        echo json_encode(["success" => true]);
        return;

    } catch (PDOException $e) {
        error_log("Erreur SQL DELETE locations: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erreur interne."]);
        return;
    }
}

http_response_code(405);
echo json_encode(["success" => false, "message" => "Méthode non autorisée."]);
