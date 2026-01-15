<?php
// ===============================================
// NOUVEAU SYSTEME CORS (basé sur .env)
// ===============================================

require_once __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Récupère les origines autorisées depuis .env
$allowedOrigins = explode(',', $_ENV['CORS_ORIGINS'] ?? '');

// Origine de la requête
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

// Si l'origine est autorisée, on l'ajoute dans les headers
if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
}

header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

// Réponse immédiate pour les requêtes preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
