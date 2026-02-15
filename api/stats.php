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

// Construction du WHERE principal
$where = "WHERE $periodFilter";
$params = [];

// GLOBAL
if ($parcId === "all") {
    $where .= " AND parc_id IS NULL AND location_id IS NULL";
}
// PAR PARC
else {
    $where .= " AND parc_id = :parc_id AND location_id IS NULL";
    $params[":parc_id"] = intval($parcId);
}

// 1) Récupération de LA bonne ligne (pas d’agrégation)
$sql = "
    SELECT 
        total_captures AS totalCaptures,
        unique_captures AS uniqueCaptures,
        premium_captures AS premiumCaptures,
        free_captures AS freeCaptures,
        active_users AS activeUsers,
        new_users AS newUsers,
        total_users AS totalUsers,
        avg_captures_per_user AS avgCapturesPerUser,
        avg_free_per_user AS avgFreePerUser,
        avg_premium_per_user AS avgPremiumPerUser,
        conversion_rate AS conversionRate,
        revenue_cents AS revenueCents,
        paying_users AS payingUsers
    FROM stats_daily
    $where
    LIMIT 1
";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$stats = $stmt->fetch(PDO::FETCH_ASSOC);

// Si aucune ligne trouvée → valeurs par défaut
if (!$stats) {
    $stats = [
        "totalCaptures" => 0,
        "uniqueCaptures" => 0,
        "premiumCaptures" => 0,
        "freeCaptures" => 0,
        "activeUsers" => 0,
        "newUsers" => 0,
        "totalUsers" => 0,
        "avgCapturesPerUser" => 0,
        "avgFreePerUser" => 0,
        "avgPremiumPerUser" => 0,
        "conversionRate" => 0,
        "revenueCents" => 0,
        "payingUsers" => 0
    ];
}

// 2) Top 5 locations (avec noms + parc)
$sql = "
    SELECT 
        l.id AS location_id,
        l.name AS location_name,
        p.name AS parc_name,
        SUM(sd.total_captures) AS total
    FROM stats_daily sd
    LEFT JOIN locations l ON sd.location_id = l.id
    LEFT JOIN parcs p ON l.parc_id = p.id
    WHERE $periodFilter
    " . ($parcId === "all" ? "" : " AND sd.parc_id = :parc_id ") . "
    AND sd.location_id IS NOT NULL
    GROUP BY sd.location_id
    ORDER BY total DESC
    LIMIT 5
";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$topLocations = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Formatage du label selon le filtre
foreach ($topLocations as &$loc) {
    if ($parcId === "all") {
        // Global → afficher "Location (Parc)"
        $loc["label"] = $loc["location_name"] . " (" . $loc["parc_name"] . ")";
    } else {
        // Par parc → afficher seulement la location
        $loc["label"] = $loc["location_name"];
    }
}

// Ajout au résultat
$stats["topLocations"] = $topLocations;

// Réponse JSON
echo json_encode([
    "success" => true,
    "stats" => $stats
]);
