<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// ---------------------------------------------------------
// 0) Lecture du POST (UNE SEULE FOIS)
// ---------------------------------------------------------
$raw = file_get_contents("php://input"); 
error_log(">>> [Gemini] RAW POST : " . $raw); 

$data = json_decode($raw, true); 
error_log(">>> [Gemini] DATA DECODED : " . print_r($data, true)); 

$imageBase64 = $data["image"] ?? null; 
$target = $data["target"] ?? null; 

if (!$imageBase64 || !$target) { error_log(">>> [Gemini] ERREUR : image ou target manquante"); 
    http_response_code(400); 
    echo json_encode(["error" => "Image ou cible manquante"]); 
exit; }

error_log(">>> [Gemini] Image reçue (taille base64) : " . strlen($imageBase64));

// ---------------------------------------------------------
// 1) Chargement credentials
// ---------------------------------------------------------
$credentialsPath = __DIR__ . "/gen-lang-client-0774329877-3fe700b41a3a.json";
if (!file_exists($credentialsPath)) {
    error_log(">>> [Gemini] ERREUR : fichier credentials introuvable");
    http_response_code(500);
    echo json_encode(["error" => "Fichier JSON introuvable"]);
    exit;
}
$credentials = json_decode(file_get_contents($credentialsPath), true);

function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function compressBase64Image($base64, $maxWidth = 1024, $quality = 75) {
    // 1. Décoder le base64
    $imageData = base64_decode($base64);
    $source = imagecreatefromstring($imageData);

    if (!$source) {
        error_log(">>> [Gemini] ERREUR : impossible de décoder l'image pour compression");
        return $base64; // fallback
    }

    // 2. Dimensions originales
    $width = imagesx($source);
    $height = imagesy($source);

    // 3. Calcul du redimensionnement
    if ($width > $maxWidth) {
        $ratio = $maxWidth / $width;
        $newWidth = $maxWidth;
        $newHeight = intval($height * $ratio);
    } else {
        $newWidth = $width;
        $newHeight = $height;
    }

    // 4. Redimensionnement
    $resized = imagecreatetruecolor($newWidth, $newHeight);
    imagecopyresampled($resized, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

    // 5. Compression JPEG
    ob_start();
    imagejpeg($resized, null, $quality);
    $compressedData = ob_get_clean();

    // 6. Ré-encodage base64
    return base64_encode($compressedData);
}


// ---------------------------------------------------------
// 2) Génération JWT
// ---------------------------------------------------------
$header = ['alg' => 'RS256', 'typ' => 'JWT'];
$now = time();
$payload = [
    "iss" => $credentials["client_email"],
    "scope" => "https://www.googleapis.com/auth/generative-language",
    "aud" => "https://oauth2.googleapis.com/token",
    "exp" => $now + 3600,
    "iat" => $now
];

$jwtHeader = base64url_encode(json_encode($header));
$jwtPayload = base64url_encode(json_encode($payload));
$signatureInput = $jwtHeader . "." . $jwtPayload;
openssl_sign($signatureInput, $signature, $credentials["private_key"], "sha256WithRSAEncryption");
$jwtSignature = base64url_encode($signature);
$jwt = $signatureInput . "." . $jwtSignature;

// ---------------------------------------------------------
// 3) Récupération token OAuth
// ---------------------------------------------------------
$tokenCurl = curl_init("https://oauth2.googleapis.com/token");
curl_setopt_array($tokenCurl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ["Content-Type: application/x-www-form-urlencoded"],
    CURLOPT_POSTFIELDS => http_build_query([
        "grant_type" => "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion" => $jwt
    ])
]);
$tokenResponse = curl_exec($tokenCurl);
$tokenCode = curl_getinfo($tokenCurl, CURLINFO_HTTP_CODE);
curl_close($tokenCurl);

$tokenData = json_decode($tokenResponse, true);
$accessToken = $tokenData["access_token"] ?? null;

if (!$accessToken) {
    error_log(">>> [Gemini] ERREUR : token OAuth introuvable");
    http_response_code(500);
    echo json_encode([
        "error" => "Token OAuth introuvable",
        "details" => $tokenData
    ]);
    exit;
}

// ---------------------------------------------------------
// 4) Construction payload Gemini
// ---------------------------------------------------------
$apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";

$payload = [
    "contents" => [[
        "parts" => [
            [
                "inline_data" => [
                    "mime_type" => "image/jpeg",
                    "data" => $imageBase64
                ]
            ],
            [
                "text" =>
                "INSTRUCTION: Add a high-quality 3D Pixar-style character named \"{$target["characterName"]}\" into this photo.
                Placement context: {$target["promptContext"]}.
                Requirements: The character must look like a 3D asset perfectly integrated with correct lighting, shadows, and depth (occlusion).

                AFTER generating the modified image:
                Write a short, fun, only french, immersive quote (1 sentence) spoken by the character.
                Return BOTH the image AND the quote."
            ]
        ]
    ]],
];

// ---------------------------------------------------------
// 5) Appel Gemini
// ---------------------------------------------------------
$ch = curl_init($apiUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer $accessToken",
        "Content-Type: application/json"
    ],
    CURLOPT_POSTFIELDS => json_encode($payload)
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

error_log(">>> [Gemini] Réponse brute Gemini : " . substr($response, 0, 200));

// ---------------------------------------------------------
// 6) Gestion erreurs Gemini
// ---------------------------------------------------------
if ($httpCode !== 200) {
    error_log(">>> [Gemini] ERREUR HTTP $httpCode");
    http_response_code($httpCode);
    echo json_encode([
        "error" => "Erreur Gemini",
        "status" => $httpCode,
        "response" => $response
    ]);
    exit;
}

// ---------------------------------------------------------
// 7) Extraction image + texte
// ---------------------------------------------------------
$geminiData = json_decode($response, true);
$parts = $geminiData["candidates"][0]["content"]["parts"] ?? [];


$finalImage = "";
$quote = "";

foreach ($parts as $p) {
    if (isset($p["inlineData"]["data"])) {
        $finalImage = $p["inlineData"]["data"];
        error_log(">>> [Gemini] Image générée trouvée (base64)");
    }

    if (isset($p["text"])) {
        $quote = trim($p["text"]);
        error_log(">>> [Gemini] Texte généré : " . $quote);
    }
}

if (!$quote) {
    $quote = "texte error par défaut !";
    error_log(">>> [Gemini] Aucune citation → fallback");
}

error_log(">>> [Gemini] FINAL IMAGE LENGTH = " . strlen($finalImage));

// ---------------------------------------------------------
// 7.5) Compression de l'image générée
// ---------------------------------------------------------
$compressedImage = compressBase64Image($finalImage, 1024, 75);
error_log(">>> [Gemini] Compressed image size = " . strlen($compressedImage));

// On remplace l'image finale par la version compressée
$finalImage = $compressedImage;

// ---------------------------------------------------------
// 8) Insertion en base
// ---------------------------------------------------------
require_once __DIR__ . "/db.php";

$userId = $data["userId"];
$locationId = $target["id"];

$stmt = $pdo->prepare("
    INSERT INTO collection (userId, locationId, photoUrl, quote)
    VALUES (:userId, :locationId, :photoUrl, :quote)
");

$stmt->execute([
    ":userId" => $userId,
    ":locationId" => $locationId,
    ":photoUrl" => $finalImage,
    ":quote" => $quote
]);

error_log(">>> [Gemini] Image insérée en base pour user=$userId loc=$locationId");

// ---------------------------------------------------------
// 9) Réponse frontend
// ---------------------------------------------------------
echo json_encode([
    "success" => true,
    "item" => [
        "locationId" => $locationId,
        "photoUrl"   => $finalImage,
        "quote"      => $quote,
        "capturedAt" => date("Y-m-d H:i:s")
    ]
]);

error_log(">>> [Gemini] Réponse envoyée au frontend");
