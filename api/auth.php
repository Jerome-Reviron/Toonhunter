<?php
// ---------------------------------------------------------
// MIDDLEWARE DE PROTECTION SESSION
// ---------------------------------------------------------

require_once __DIR__ . "/cors.php";
require_once __DIR__ . "/db.php";

// Démarre la session uniquement ici
session_start();

header("Content-Type: application/json; charset=UTF-8");

// Vérifie que l'utilisateur est connecté
if (!isset($_SESSION['user_id']) || !is_numeric($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "Accès non autorisé."
    ]);
    exit;
}
