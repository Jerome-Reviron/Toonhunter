<?php
// ---------------------------------------------------------
// cleanup.php — Nettoyage automatique + email J-3
// Script destiné à être exécuté UNIQUEMENT par CRON
// ---------------------------------------------------------

// 🔒 Empêche l'accès via navigateur
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo "Forbidden";
    exit;
}

// Chargement des dépendances
require_once __DIR__ . "/cors.php"; // même structure que tes autres fichiers
require_once __DIR__ . "/db.php";
require_once __DIR__ . "/vendor/autoload.php";

// Chargement du .env
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Connexion PDO (identique à tous tes fichiers)
$pdo = $pdo ?? null;
if (!$pdo) {
    http_response_code(500);
    echo "Erreur PDO";
    exit;
}

// ---------------------------------------------------------
// 1) ENVOI EMAIL J-3 (collections âgées de 4 jours)
// ---------------------------------------------------------

try {
    $stmt = $pdo->prepare("
        SELECT c.id, c.userId, c.capturedAt, u.email
        FROM collection c
        JOIN users u ON u.id = c.userId
        WHERE c.capturedAt < NOW() - INTERVAL 12 DAY
        AND c.capturedAt > NOW() - INTERVAL 15 DAY
        AND c.notified = 0
    ");
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rows as $row) {
        $email = $row['email'];

        // Envoi email via PHPMailer
        $mail = new PHPMailer\PHPMailer\PHPMailer(true);

        try {
            $mail->isSMTP();
            $mail->Host = $_ENV['SMTP_HOST'];
            $mail->SMTPAuth = true;
            $mail->Username = $_ENV['SMTP_USER'];
            $mail->Password = $_ENV['SMTP_PASS'];
            $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
            $mail->Port = $_ENV['SMTP_PORT'];

            $mail->setFrom($_ENV['SMTP_FROM'], 'ToonHunter');
            $mail->addAddress($email);

            $mail->isHTML(true);
            $mail->Subject = "Votre collection sera supprimée dans 3 jours";
            $mail->Body = "
                <p>Bonjour,</p>
                <p>Une ou plusieurs photos de votre collection ToonHunter seront automatiquement supprimées dans <strong>3 jours</strong>.</p>
                <p>Si vous souhaitez les conserver, connectez-vous à votre compte et téléchargez les!</p>
                <p>N'hésitez pas à les partager sur les réseaux sociaux en mentionnant <strong>@ToonHunterApp</strong> pour nous aider à faire connaître le service.</p>
                <p>Voici le lien pour vous connecter à votre compte : <a href='https://toonhunter.fr/login.php'>Se connecter</a></p>
                <p>À bientôt,<br>L'équipe ToonHunter</p>
            ";

            $mail->send();

            // Marquer comme notifié
            $update = $pdo->prepare("UPDATE collection SET notified = 1 WHERE id = ?");
            $update->execute([$row['id']]);

        } catch (Exception $e) {
            // Optionnel : log
            error_log("Erreur email cleanup: " . $e->getMessage());
        }
    }

} catch (Exception $e) {
    error_log("Erreur SQL J-3 cleanup: " . $e->getMessage());
}



// ---------------------------------------------------------
// 2) SUPPRESSION DES COLLECTIONS > 7 jours
// ---------------------------------------------------------

try {
    $delete = $pdo->prepare("
        DELETE FROM collection
        WHERE capturedAt < NOW() - INTERVAL 7 DAY
    ");
    $delete->execute();

} catch (Exception $e) {
    error_log("Erreur SQL suppression cleanup: " . $e->getMessage());
}



// ---------------------------------------------------------
// Fin du script
// ---------------------------------------------------------

echo "Cleanup terminé.\n";
