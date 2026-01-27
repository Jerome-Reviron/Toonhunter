<?php
require_once __DIR__ . "/cors.php";
require_once __DIR__ . "/db.php";

session_start();

header("Content-Type: application/json; charset=UTF-8");

// ---------------------------------------------------------
// DESTRUCTION SÉCURISÉE DE LA SESSION
// ---------------------------------------------------------

// Vide toutes les variables de session
$_SESSION = [];

// Supprime le cookie PHPSESSID
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 3600,
        $params["path"],
        $params["domain"],
        $params["secure"],
        $params["httponly"]
    );
}

// Détruit la session côté serveur
session_destroy();

// Réponse JSON
echo json_encode([
    "success" => true,
    "message" => "Déconnexion réussie."
]);
exit;
