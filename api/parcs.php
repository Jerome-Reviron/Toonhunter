<?php

require_once __DIR__ . "/cors.php";
require_once __DIR__ . "/db.php";

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ---------------------------------------------------------
// 🔒 Fonction : vérifier si un userId est admin
// ---------------------------------------------------------
function requireAdmin(PDO $pdo, $userId)
{
    $userId = intval($userId);

    if ($userId <= 0) {
        http_response_code(401);
        echo json_encode(["success" => false, "message" => "Utilisateur non authentifié."]);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT role FROM users WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erreur interne."]);
        exit;
    }

    if (!$user || strtolower($user['role']) !== 'admin') {
        http_response_code(403);
        echo json_encode(["success" => false, "message" => "Accès refusé."]);
        exit;
    }

    return true;
}

// ---------------------------------------------------------
// GET : récupérer tous les parcs (PUBLIC)
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    try {
        $stmt = $pdo->query("SELECT * FROM parcs ORDER BY name ASC");
        $parcs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(["success" => true, "parcs" => $parcs]);
        return;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erreur interne."]);
        return;
    }
}

// ---------------------------------------------------------
// POST : créer un parc (ADMIN ONLY)
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $raw = file_get_contents("php://input");
    $data = json_decode($raw);

    if (!$data || !isset($data->name) || !isset($data->logo)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Champs manquants."]);
        return;
    }

    $userId = intval($data->userId ?? 0);
    requireAdmin($pdo, $userId);

    $name = trim($data->name);
    $logo = trim($data->logo);

    try {
        $stmt = $pdo->prepare("INSERT INTO parcs (name, logo) VALUES (:name, :logo)");
        $stmt->execute([
            ':name' => $name,
            ':logo' => $logo
        ]);

        echo json_encode(["success" => true, "id" => (int)$pdo->lastInsertId()]);
        return;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erreur interne."]);
        return;
    }
}

// ---------------------------------------------------------
// PUT : modifier un parc (ADMIN ONLY)
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {

    $raw = file_get_contents("php://input");
    $data = json_decode($raw);

    if (!$data || !isset($data->id)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "ID manquant."]);
        return;
    }

    $userId = intval($data->userId ?? 0);
    requireAdmin($pdo, $userId);

    $id   = intval($data->id);
    $name = trim($data->name ?? '');
    $logo = trim($data->logo ?? '');

    if ($name === '' || $logo === '') {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Champs obligatoires manquants."]);
        return;
    }

    try {
        $stmt = $pdo->prepare("
            UPDATE parcs SET
                name = :name,
                logo = :logo
            WHERE id = :id
        ");

        $stmt->execute([
            ':id'   => $id,
            ':name' => $name,
            ':logo' => $logo
        ]);

        echo json_encode(["success" => true]);
        return;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erreur interne."]);
        return;
    }
}

// ---------------------------------------------------------
// DELETE : supprimer un parc (ADMIN ONLY)
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {

    $raw = file_get_contents("php://input");
    $data = json_decode($raw);

    if (!$data || !isset($data->id)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "ID manquant."]);
        return;
    }

    $userId = intval($data->userId ?? 0);
    requireAdmin($pdo, $userId);

    $id = intval($data->id);

    try {
        $stmt = $pdo->prepare("DELETE FROM parcs WHERE id = :id");
        $stmt->execute([':id' => $id]);

        echo json_encode(["success" => true]);
        return;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erreur interne."]);
        return;
    }
}

http_response_code(405);
echo json_encode(["success" => false, "message" => "Méthode non autorisée."]);
