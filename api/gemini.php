<?php
require_once __DIR__ . "/cors.php";
// 🔵 AJOUT : protection session + auth 
require_once __DIR__ . "/auth.php";

header("Content-Type: application/json");

// 🔵 AJOUT : vérifier que l’utilisateur est connecté 
if (!isset($_SESSION['user_id'])) { 
    http_response_code(401); 
    echo json_encode(["error" => "Non authentifié"]); 
    exit; 
}

// ---------------------------------------------------------
// 0) Lecture du POST (UNE SEULE FOIS)
// ---------------------------------------------------------
$raw = file_get_contents("php://input"); 
// error_log(">>> [Gemini] RAW POST : " . $raw); 

$data = json_decode($raw, true); 
// error_log(">>> [Gemini] DATA DECODED : " . print_r($data, true)); 

$imageBase64 = $data["image"] ?? null; 
$target = $data["target"] ?? null; 

if (!$imageBase64 || !$target) { error_log(">>> [Gemini] ERREUR : image ou target manquante"); 
    http_response_code(400); 
    echo json_encode(["error" => "Image ou cible manquante"]); 
exit; }

// --------------------------------------------------------- 
// 🔐 Limite de taille image (5 Mo max) 
// --------------------------------------------------------- 
if (strlen($imageBase64) > 6 * 1024 * 1024) { // 6 Mo 
    error_log(">>> [Gemini] ERREUR : image trop volumineuse (" . strlen($imageBase64) . " octets)"); 
    http_response_code(413); // Payload Too Large 
    echo json_encode(["error" => "Image trop volumineuse (max 5 Mo)"]); 
    exit; 
}

// error_log(">>> [Gemini] Image reçue (taille base64) : " . strlen($imageBase64));

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

// error_log(">>> [Gemini] Réponse brute Gemini : " . substr($response, 0, 200));

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
        // error_log(">>> [Gemini] Image générée trouvée (base64)");
    }

    if (isset($p["text"])) {
        $quote = trim($p["text"]);
        // error_log(">>> [Gemini] Texte généré : " . $quote);
    }
}

if (!$quote) {
    $quote = "texte error par défaut !";
    error_log(">>> [Gemini] Aucune citation → fallback");
}

// error_log(">>> [Gemini] FINAL IMAGE LENGTH = " . strlen($finalImage));

// ---------------------------------------------------------
// 7.5) Compression de l'image générée
// ---------------------------------------------------------
$compressedImage = compressBase64Image($finalImage, 1024, 75);
// error_log(">>> [Gemini] Compressed image size = " . strlen($compressedImage));

// On remplace l'image finale par la version compressée
$finalImage = $compressedImage;

// ---------------------------------------------------------
// 8) Insertion en base (préparation)
// ---------------------------------------------------------
require_once __DIR__ . "/db.php";

// 🔵 AJOUT : on utilise la session pour éviter l'usurpation 
$userId = $_SESSION['user_id'];
$locationId = $target["id"];


// ---------------------------------------------------------
// 8.5) Watermark : ajout du logo du parc en bas à droite (safe)
// ---------------------------------------------------------

// Si GD n'est pas dispo, on ne tente rien
if (function_exists('imagecreatefromstring')) {
    try {
        // 1) Récupérer le parc associé à la location
        $stmt = $pdo->prepare("SELECT parc_id FROM locations WHERE id = ?");
        $stmt->execute([$locationId]);
        $parcId = $stmt->fetchColumn();

        if ($parcId) {
            // 2) Récupérer le logo du parc
            $stmt = $pdo->prepare("SELECT logo FROM parcs WHERE id = ?");
            $stmt->execute([$parcId]);
            $logoData = $stmt->fetchColumn();

            if ($logoData && $finalImage) {
                // 3) Extraire la partie base64 (enlever le prefix data:...;base64,)
                if (strpos($logoData, 'base64,') !== false) {
                    $logoData = explode('base64,', $logoData)[1];
                }

                $logoBinary = base64_decode($logoData);
                $finalBinary = base64_decode($finalImage);

                if ($logoBinary && $finalBinary) {
                    $logoImg = @imagecreatefromstring($logoBinary);
                    $generatedImg = @imagecreatefromstring($finalBinary);

                    if ($logoImg && $generatedImg) {
                        $genW = imagesx($generatedImg);
                        $genH = imagesy($generatedImg);
                        $logoW = imagesx($logoImg);
                        $logoH = imagesy($logoImg);

                        // 6) Redimensionner le logo (max 15% de la largeur)
                        $maxLogoWidth = intval($genW * 0.25);
                        if ($logoW > $maxLogoWidth) {
                            $ratio = $maxLogoWidth / $logoW;
                            $newLogoW = $maxLogoWidth;
                            $newLogoH = intval($logoH * $ratio);

                            // ✅ Création d’un canvas transparent
                            $resizedLogo = imagecreatetruecolor($newLogoW, $newLogoH);
                            imagesavealpha($resizedLogo, true);
                            $transparent = imagecolorallocatealpha($resizedLogo, 0, 0, 0, 127);
                            imagefill($resizedLogo, 0, 0, $transparent);

                            // ✅ Copie du logo avec alpha
                            imagecopyresampled(
                                $resizedLogo,
                                $logoImg,
                                0, 0, 0, 0,
                                $newLogoW, $newLogoH,
                                $logoW, $logoH
                            );

                            $logoImg = $resizedLogo;
                            $logoW = $newLogoW;
                            $logoH = $newLogoH;
                        }


                        // 7) Position bas droite avec marge
                        $margin = 20;
                        $dstX = $genW - $logoW - $margin;
                        $dstY = $genH - $logoH - $margin;

                        // 8) Fusion du logo sur l'image générée
                        imagesavealpha($generatedImg, true);
                        imagecopy($generatedImg, $logoImg, $dstX, $dstY, 0, 0, $logoW, $logoH);

                        // 9) Ré-encodage final en base64
                        ob_start();
                        imagejpeg($generatedImg, null, 90);
                        $finalImage = base64_encode(ob_get_clean());
                    } else {
                        error_log(">>> [Gemini] Watermark : échec imagecreatefromstring");
                    }
                } else {
                    error_log(">>> [Gemini] Watermark : base64 decode vide");
                }
            } else {
                error_log(">>> [Gemini] Watermark : pas de logo ou pas d'image finale");
            }
        } else {
            error_log(">>> [Gemini] Watermark : aucun parc_id pour locationId=$locationId");
        }
    } catch (Throwable $e) {
        error_log(">>> [Gemini] Watermark ERROR : " . $e->getMessage());
        // on ne jette pas d'erreur vers le frontend, on continue sans watermark
    }
} else {
    error_log(">>> [Gemini] Watermark : GD non disponible (imagecreatefromstring absent)");
}

// ---------------------------------------------------------
// 8.6) Insertion en base (capture dans la collection)
// ---------------------------------------------------------
try {
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

    error_log(">>> [Gemini] Capture insérée en base pour user=$userId, location=$locationId");
} catch (Throwable $e) {
    error_log(">>> [Gemini] ERREUR INSERT COLLECTION : " . $e->getMessage());
}

// ---------------------------------------------------------
// 9) Réponse frontend
// ---------------------------------------------------------

// 🔥 LOG FINAL POUR DEBUG
// error_log(">>> [Gemini] JSON FINAL : " . json_encode([
//     "success" => true,
//     "item" => [
//         "locationId" => $locationId,
//         "photoUrl"   => $finalImage,
//         "quote"      => $quote,
//         "capturedAt" => date("Y-m-d H:i:s")
//     ]
// ]));

echo json_encode([
    "success" => true,
    "item" => [
        "locationId" => $locationId,
        "photoUrl"   => $finalImage,
        "quote"      => $quote,
        "capturedAt" => date("Y-m-d H:i:s")
    ]
]);

// error_log(">>> [Gemini] FIN DU SCRIPT");
