<?php
use Dotenv\Dotenv;

require_once __DIR__ . '/vendor/autoload.php';

$dotenv = \Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

date_default_timezone_set('Europe/Paris');
// ---------------------------------------------------------
// CORS dynamique
// ---------------------------------------------------------
$allowedOrigins = explode(',', $_ENV['CORS_ORIGINS'] ?? '');
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($requestOrigin && in_array($requestOrigin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $requestOrigin");
}

// Headers CORS généraux
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Réponse immédiate aux préflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}


// ---------------------------------------------------------
// Connexion BDD via PDO
// ---------------------------------------------------------
$host    = $_ENV['DB_HOST'] ?? '127.0.0.1';
$db      = $_ENV['DB_NAME'] ?? '';
$user    = $_ENV['DB_USER'] ?? '';
$pass    = $_ENV['DB_PASS'] ?? '';
$charset = $_ENV['DB_CHARSET'] ?? 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
    // --------------------------------------------------------- 
    // Fuseau horaire MySQL (session) 
    // --------------------------------------------------------- 
    $pdo->exec("SET time_zone = '+01:00'");
} catch (PDOException $e) {
    error_log('Erreur de connexion BDD: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Erreur interne, veuillez réessayer plus tard."
    ]);
    exit;
}
