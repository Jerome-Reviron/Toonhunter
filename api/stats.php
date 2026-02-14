<?php
require_once __DIR__ . "/auth.php";
require_once __DIR__ . "/db.php";

header("Content-Type: application/json; charset=UTF-8");

// Vérification admin
if (!isset($_SESSION["role"]) || $_SESSION["role"] !== "admin") {
    http_response_code(403);
    echo json_encode(["success" => false, "message" => "Accès refusé"]);
    exit;
}

// GET params
$parcId = $_GET["parc_id"] ?? "all";
$period = $_GET["period"] ?? "day";

// Filtre période basé sur stats_daily.date
switch ($period) {
    case "day":
        $periodFilter = "date = CURDATE()";
        break;
    case "week":
        $periodFilter = "YEARWEEK(date, 1) = YEARWEEK(CURDATE(), 1)";
        break;
    case "month":
        $periodFilter = "YEAR(date) = YEAR(CURDATE()) AND MONTH(date) = MONTH(CURDATE())";
        break;
    case "year":
        $periodFilter = "YEAR(date) = YEAR(CURDATE())";
        break;
    default:
        $periodFilter = "1";
}

// Filtre parc
$parcFilter = "";
$params = [];

if ($parcId !== "all") {
    $parcFilter = " AND parc_id = :parc_id";
    $params[":parc_id"] = intval($parcId);
}

// 1) Agrégation des stats
$sql = "
    SELECT 
        SUM(total_captures) AS totalCaptures,
        SUM(unique_captures) AS uniqueCaptures,
        SUM(premium_captures) AS premiumCaptures,
        SUM(free_captures) AS freeCaptures,
        SUM(active_users) AS activeUsers,
        SUM(new_users) AS newUsers,
        MAX(total_users) AS totalUsers, 
        AVG(avg_captures_per_user) AS avgCapturesPerUser,
        AVG(avg_free_per_user) AS avgFreePerUser,
        AVG(avg_premium_per_user) AS avgPremiumPerUser,
        AVG(conversion_rate) AS conversionRate,
        SUM(revenue_cents) AS revenueCents,
        SUM(paying_users) AS payingUsers
    FROM stats_daily
    WHERE $periodFilter $parcFilter
";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$stats = $stmt->fetch(PDO::FETCH_ASSOC);

// 2) Top 5 locations (déjà agrégées dans stats_daily)
$sql = "
    SELECT 
        location_id,
        SUM(total_captures) AS total
    FROM stats_daily
    WHERE $periodFilter $parcFilter AND location_id IS NOT NULL
    GROUP BY location_id
    ORDER BY total DESC
    LIMIT 5
";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$topLocations = $stmt->fetchAll(PDO::FETCH_ASSOC);

// On intègre topLocations DANS stats
$stats["topLocations"] = $topLocations;

// Réponse JSON
echo json_encode([
    "success" => true,
    "stats" => $stats
]);
