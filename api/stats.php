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
        $periodFilter = "date = CURDATE() - INTERVAL 1 DAY";
        break;
    case "week":
        $periodFilter = "date BETWEEN CURDATE() - INTERVAL 7 DAY AND CURDATE() - INTERVAL 1 DAY";
        break;
    case "month":
        $periodFilter = "date BETWEEN CURDATE() - INTERVAL 31 DAY AND CURDATE() - INTERVAL 1 DAY";
        break;
    case "year":
        $periodFilter = "date BETWEEN CURDATE() - INTERVAL 365 DAY AND CURDATE() - INTERVAL 1 DAY";
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
} else {
    // PAR PARC
    $where .= " AND parc_id = :parc_id AND location_id IS NULL";
    $params[":parc_id"] = intval($parcId);
}

// 1) Récupération des stats (agrégées sauf pour "day")
if ($period === "day") {
    // Une seule ligne
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
} else {
    // Agrégation brute : on calcule les moyennes en PHP
    $sql = "
        SELECT 
            SUM(total_captures) AS totalCaptures,
            SUM(unique_captures) AS uniqueCaptures,
            SUM(premium_captures) AS premiumCaptures,
            SUM(free_captures) AS freeCaptures,
            SUM(active_users) AS activeUsers,
            SUM(new_users) AS newUsers,
            MAX(total_users) AS totalUsers,
            SUM(revenue_cents) AS revenueCents,
            SUM(paying_users) AS payingUsers
        FROM stats_daily
        $where
    ";
}

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
} else {
    // Normalisation des types
    $stats["totalCaptures"]   = (int) ($stats["totalCaptures"] ?? 0);
    $stats["uniqueCaptures"]  = (int) ($stats["uniqueCaptures"] ?? 0);
    $stats["premiumCaptures"] = (int) ($stats["premiumCaptures"] ?? 0);
    $stats["freeCaptures"]    = (int) ($stats["freeCaptures"] ?? 0);
    $stats["activeUsers"]     = (int) ($stats["activeUsers"] ?? 0);
    $stats["newUsers"]        = (int) ($stats["newUsers"] ?? 0);
    $stats["totalUsers"]      = (int) ($stats["totalUsers"] ?? 0);
    $stats["revenueCents"]    = (int) ($stats["revenueCents"] ?? 0);
    $stats["payingUsers"]     = (int) ($stats["payingUsers"] ?? 0);

    if ($period === "day") {

        // Stats déjà calculées dans stats_daily
        $stats["avgCapturesPerUser"] = (float) ($stats["avgCapturesPerUser"] ?? 0);
        $stats["avgFreePerUser"]     = (float) ($stats["avgFreePerUser"] ?? 0);
        $stats["avgPremiumPerUser"]  = (float) ($stats["avgPremiumPerUser"] ?? 0);
        $stats["conversionRate"]     = (float) ($stats["conversionRate"] ?? 0);

    } else {

        // Recalcul des moyennes
        $totalCaptures   = $stats["totalCaptures"];
        $freeCaptures    = $stats["freeCaptures"];
        $premiumCaptures = $stats["premiumCaptures"];
        $activeUsers     = $stats["activeUsers"];

        $stats["avgCapturesPerUser"] = $activeUsers > 0 ? $totalCaptures / $activeUsers : 0;
        $stats["avgFreePerUser"]     = $activeUsers > 0 ? $freeCaptures / $activeUsers : 0;
        $stats["avgPremiumPerUser"]  = $activeUsers > 0 ? $premiumCaptures / $activeUsers : 0;
    }

    // 🔥 Correction du global : dédoublonnage des utilisateurs payants
    if ($parcId === "all" && $period !== "day") {

        // Récupérer les dates min/max de la période
        $sqlDates = "
            SELECT MIN(date) AS dmin, MAX(date) AS dmax
            FROM stats_daily
            WHERE $periodFilter
        ";
        $dates = $pdo->query($sqlDates)->fetch(PDO::FETCH_ASSOC);

        if ($dates && $dates["dmin"] && $dates["dmax"]) {

            // Récupérer les utilisateurs payants uniques sur la période
            $sqlUsers = "
                SELECT DISTINCT user_id
                FROM user_parc_payments
                WHERE DATE(paid_at) BETWEEN :dmin AND :dmax
            ";
            $stmtU = $pdo->prepare($sqlUsers);
            $stmtU->execute([
                ":dmin" => $dates["dmin"],
                ":dmax" => $dates["dmax"]
            ]);

            $uniquePayingUsers = $stmtU->fetchAll(PDO::FETCH_COLUMN);

            // Remplace la valeur globale par le nombre d'utilisateurs uniques
            $stats["payingUsers"] = count($uniquePayingUsers);
        }
    }

    // 🔥 Recalcul du taux de conversion APRÈS dédoublonnage
    if ($period !== "day") {
        $activeUsers = $stats["activeUsers"];
        $stats["conversionRate"] = $activeUsers > 0 
            ? $stats["payingUsers"] / $activeUsers 
            : 0;
    }
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
        $loc["label"] = $loc["location_name"] . " (" . $loc["parc_name"] . ")";
    } else {
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
