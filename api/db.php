<?php
use Dotenv\Dotenv;

require_once __DIR__ . '/vendor/autoload.php';

// Chargement des variables d'environnement
$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

date_default_timezone_set('Europe/Paris');

// ---------------------------------------------------------
// Connexion BDD via PDO (aucun header ici !)
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

    // Fuseau horaire MySQL (session)
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
