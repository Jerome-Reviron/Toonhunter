<?php
// ---------------------------------------------------------
// cron_stats_daily.php — Agrégation quotidienne des stats
// Script destiné à être exécuté UNIQUEMENT par CRON
// ---------------------------------------------------------

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo "Forbidden";
    exit;
}

require_once __DIR__ . "/db.php";

// JOUR À TRAITER = hier
$day = date("Y-m-d", strtotime("-1 day"));

// Récupération des parcs
$parcs = $pdo->query("SELECT id FROM parcs")->fetchAll(PDO::FETCH_COLUMN);

// Récupération des locations
$locations = $pdo->query("SELECT id, parc_id FROM locations")->fetchAll(PDO::FETCH_ASSOC);

// ---------------------------------------------------------
// Fonction utilitaire : calcule les stats pour un filtre donné
// ---------------------------------------------------------
function computeStats($pdo, $day, $parcId = null, $locationId = null) {

    $params = [":day" => $day];
    $filters = "DATE(collection.capturedAt) = :day";

    if ($parcId !== null) {
        $filters .= " AND locations.parc_id = :parc_id";
        $params[":parc_id"] = $parcId;
    }

    if ($locationId !== null) {
        $filters .= " AND locations.id = :location_id";
        $params[":location_id"] = $locationId;
    }

    // Total captures
    $sql = "
        SELECT COUNT(*) 
        FROM collection
        JOIN locations ON locations.id = collection.locationId
        WHERE $filters
    ";
    $totalCaptures = $pdo->prepare($sql);
    $totalCaptures->execute($params);
    $totalCaptures = $totalCaptures->fetchColumn();

    // Unique captures
    $sql = "
        SELECT COUNT(DISTINCT collection.locationId)
        FROM collection
        JOIN locations ON locations.id = collection.locationId
        WHERE $filters
    ";
    $uniqueCaptures = $pdo->prepare($sql);
    $uniqueCaptures->execute($params);
    $uniqueCaptures = $uniqueCaptures->fetchColumn();

    // Premium
    $sql = "
        SELECT COUNT(*)
        FROM collection
        JOIN locations ON locations.id = collection.locationId
        WHERE locations.free = 0 AND $filters
    ";
    $premiumCaptures = $pdo->prepare($sql);
    $premiumCaptures->execute($params);
    $premiumCaptures = $premiumCaptures->fetchColumn();

    // Free
    $sql = "
        SELECT COUNT(*)
        FROM collection
        JOIN locations ON locations.id = collection.locationId
        WHERE locations.free = 1 AND $filters
    ";
    $freeCaptures = $pdo->prepare($sql);
    $freeCaptures->execute($params);
    $freeCaptures = $freeCaptures->fetchColumn();

    // Active users
    $sql = "
        SELECT COUNT(DISTINCT userId)
        FROM collection
        JOIN locations ON locations.id = collection.locationId
        WHERE $filters
    ";
    $activeUsers = $pdo->prepare($sql);
    $activeUsers->execute($params);
    $activeUsers = $activeUsers->fetchColumn();

    // New users
    $sql = "
        SELECT COUNT(*)
        FROM users
        WHERE DATE(createdAt) = :day
    ";
    $newUsers = $pdo->prepare($sql);
    $newUsers->execute([":day" => $day]);
    $newUsers = $newUsers->fetchColumn();

    // Total users
    $totalUsers = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();

    // Moyennes
    $avgCapturesPerUser = $activeUsers > 0 ? $totalCaptures / $activeUsers : 0;
    $avgFreePerUser = $activeUsers > 0 ? $freeCaptures / $activeUsers : 0;
    $avgPremiumPerUser = $activeUsers > 0 ? $premiumCaptures / $activeUsers : 0;

    // Conversion gratuit → payant
    $sql = "
        SELECT COUNT(DISTINCT userId)
        FROM collection
        JOIN locations ON locations.id = collection.locationId
        WHERE locations.free = 1 AND $filters
    ";
    $freeUsers = $pdo->prepare($sql);
    $freeUsers->execute($params);
    $freeUsers = $freeUsers->fetchColumn();

    $sql = "
        SELECT COUNT(DISTINCT userId)
        FROM collection
        JOIN locations ON locations.id = collection.locationId
        WHERE locations.free = 0 AND $filters
    ";
    $payUsers = $pdo->prepare($sql);
    $payUsers->execute($params);
    $payUsers = $payUsers->fetchColumn();

    $conversionRate = ($freeUsers > 0) ? ($payUsers / $freeUsers) : 0;

    // ---------------------------------------------------------
    // 🔥 Stripe : CA + utilisateurs payants
    // ---------------------------------------------------------

    if ($locationId !== null) {
        $revenueCents = 0;
        $payingUsers = 0;
    } else {
        $stripeParams = [":day" => $day];
        $stripeFilter = "DATE(paid_at) = :day";

        if ($parcId !== null) {
            $stripeFilter .= " AND parc_id = :parc_id";
            $stripeParams[":parc_id"] = $parcId;
        }

        // CA du jour
        $sql = "
            SELECT COALESCE(SUM(amount_cents), 0)
            FROM user_parc_payments
            WHERE $stripeFilter
        ";
        $revenueCents = $pdo->prepare($sql);
        $revenueCents->execute($stripeParams);
        $revenueCents = $revenueCents->fetchColumn();

        // Utilisateurs payants du jour
        $sql = "
            SELECT COUNT(DISTINCT user_id)
            FROM user_parc_payments
            WHERE $stripeFilter
        ";
        $payingUsers = $pdo->prepare($sql);
        $payingUsers->execute($stripeParams);
        $payingUsers = $payingUsers->fetchColumn();
    }

    return [
        "total" => $totalCaptures,
        "unique" => $uniqueCaptures,
        "premium" => $premiumCaptures,
        "free" => $freeCaptures,
        "active" => $activeUsers,
        "new" => $newUsers,
        "totalUsers" => $totalUsers,
        "avg" => $avgCapturesPerUser,
        "avgFree" => $avgFreePerUser,
        "avgPremium" => $avgPremiumPerUser,
        "conversion" => $conversionRate,
        "revenue" => $revenueCents,
        "paying" => $payingUsers
    ];
}

// ---------------------------------------------------------
// Préparation de l’INSERT
// ---------------------------------------------------------
$insert = $pdo->prepare("
    INSERT INTO stats_daily (
        date, parc_id, location_id,
        total_captures, unique_captures, premium_captures, free_captures,
        active_users, new_users, total_users,
        avg_captures_per_user, avg_free_per_user, avg_premium_per_user,
        conversion_rate, revenue_cents, paying_users
    ) VALUES (
        :date, :parc_id, :location_id,
        :total, :unique, :premium, :free,
        :active, :new, :totalUsers,
        :avg, :avgFree, :avgPremium,
        :conversion, :revenue, :paying
    )
");

// ---------------------------------------------------------
// 1) Stats globales
// ---------------------------------------------------------
$stats = computeStats($pdo, $day);

$insert->execute([
    ":date" => $day,
    ":parc_id" => null,
    ":location_id" => null,
    ":total" => $stats["total"],
    ":unique" => $stats["unique"],
    ":premium" => $stats["premium"],
    ":free" => $stats["free"],
    ":active" => $stats["active"],
    ":new" => $stats["new"],
    ":totalUsers" => $stats["totalUsers"],
    ":avg" => $stats["avg"],
    ":avgFree" => $stats["avgFree"],
    ":avgPremium" => $stats["avgPremium"],
    ":conversion" => $stats["conversion"],
    ":revenue" => $stats["revenue"],
    ":paying" => $stats["paying"]
]);

// ---------------------------------------------------------
// 2) Stats par parc
// ---------------------------------------------------------
foreach ($parcs as $parcId) {
    $stats = computeStats($pdo, $day, $parcId);

    $insert->execute([
        ":date" => $day,
        ":parc_id" => $parcId,
        ":location_id" => null,
        ":total" => $stats["total"],
        ":unique" => $stats["unique"],
        ":premium" => $stats["premium"],
        ":free" => $stats["free"],
        ":active" => $stats["active"],
        ":new" => $stats["new"],
        ":totalUsers" => $stats["totalUsers"],
        ":avg" => $stats["avg"],
        ":avgFree" => $stats["avgFree"],
        ":avgPremium" => $stats["avgPremium"],
        ":conversion" => $stats["conversion"],
        ":revenue" => $stats["revenue"],
        ":paying" => $stats["paying"]
    ]);
}

// ---------------------------------------------------------
// 3) Stats par location (pour top 5 historique)
// ---------------------------------------------------------
foreach ($locations as $loc) {
    $stats = computeStats($pdo, $day, $loc["parc_id"], $loc["id"]);

    $insert->execute([
        ":date" => $day,
        ":parc_id" => $loc["parc_id"],
        ":location_id" => $loc["id"],
        ":total" => $stats["total"],
        ":unique" => $stats["unique"],
        ":premium" => $stats["premium"],
        ":free" => $stats["free"],
        ":active" => $stats["active"],
        ":new" => $stats["new"],
        ":totalUsers" => $stats["totalUsers"],
        ":avg" => $stats["avg"],
        ":avgFree" => $stats["avgFree"],
        ":avgPremium" => $stats["avgPremium"],
        ":conversion" => $stats["conversion"],
        ":revenue" => $stats["revenue"],
        ":paying" => $stats["paying"]
    ]);
}

echo "OK — Stats du $day générées.\n";
