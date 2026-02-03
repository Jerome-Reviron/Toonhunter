<?php
# ---------------------------------------------------------
# Connexion BDD en local
# ---------------------------------------------------------
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

// #---------------------------------------------------------
// # Connexion BDD en production (Hostinger)
// #---------------------------------------------------------
// ini_set('display_errors', 1);
// error_reporting(E_ALL);

// use Dotenv\Dotenv;

// require_once __DIR__ . '/vendor/autoload.php';

// #============================================================
// #1) Chargement Dotenv (si Hostinger l’autorise)
// #============================================================
// $dotenv = Dotenv::createImmutable(__DIR__);
// $dotenv->load();

// #============================================================
// #2) Loader manuel .env (100% compatible Hostinger)
// #============================================================ 
// $envPath = __DIR__ . '/.env';

// if (file_exists($envPath)) {
//     $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

//     foreach ($lines as $line) {
//         // Ignore commentaires
//         if (str_starts_with(trim($line), '#')) {
//             continue;
//         }

//         if (strpos($line, '=') !== false) {
//             list($key, $value) = explode('=', $line, 2);
//             $key = trim($key);
//             $value = trim($value);

//             // On remplit $_ENV et putenv()
//             $_ENV[$key] = $value;
//             putenv("$key=$value");
//         }
//     }
// }

// date_default_timezone_set('Europe/Paris');

// #============================================================
// #3) Lecture des variables (fallback sécurisé)
// #============================================================ 
// $host    = $_ENV['DB_HOST']    ?? getenv('DB_HOST')    ?? '127.0.0.1';
// $db      = $_ENV['DB_NAME']    ?? getenv('DB_NAME')    ?? '';
// $user    = $_ENV['DB_USER']    ?? getenv('DB_USER')    ?? '';
// $pass    = $_ENV['DB_PASS']    ?? getenv('DB_PASS')    ?? '';
// $charset = $_ENV['DB_CHARSET'] ?? getenv('DB_CHARSET') ?? 'utf8mb4';

// #============================================================
// #4) Connexion PDO
// #============================================================
// $dsn = "mysql:host=127.0.0.1;dbname=$db;charset=$charset";

// $options = [
//     PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
//     PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
//     PDO::ATTR_EMULATE_PREPARES   => false,
// ];

// try {
//     $pdo = new PDO($dsn, $user, $pass, $options);

//     // Fuseau horaire MySQL
//     $pdo->exec("SET time_zone = '+01:00'");

// } catch (PDOException $e) {
//     http_response_code(500);

//     // Affichage direct de l’erreur (temporaire)
//     echo "<pre style='color:red; font-size:16px;'>";
//     echo "ERREUR PDO : " . $e->getMessage() . "\n";
//     echo "</pre>";

//     error_log('Erreur de connexion BDD: ' . $e->getMessage());
//     exit;
// }
