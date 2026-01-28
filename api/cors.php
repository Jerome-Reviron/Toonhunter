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
    header("Vary: Origin"); // 🔧 recommandé pour CORS dynamique
}

header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

// ===============================================
// 🔐 HEADERS DE SÉCURITÉ (CRITIQUES POUR LA PROD)
// ===============================================

// 1. Anti-XSS / Anti-injection (désactivé en dev)
// header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none';");

// 2. Anti-clickjacking
header("X-Frame-Options: DENY");

// 3. HTTPS obligatoire (HSTS)
header("Strict-Transport-Security: max-age=63072000; includeSubDomains; preload");

// 4. Empêche le sniffing de type MIME
header("X-Content-Type-Options: nosniff");

// ===============================================
// Réponse immédiate pour les requêtes preflight
// ===============================================
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
