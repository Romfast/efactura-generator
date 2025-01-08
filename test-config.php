<?php
class ConfigTester {
    private $config;
    private $uploadDir;
    private $results = [];

    public function __construct() {
        $this->uploadDir = dirname(__FILE__) . '/temp/';
    }

    public function runTests() {
        echo "<h1>Test Configurație eFactura</h1>";
        
        // Testează config.json
        $this->testConfigFile();
        
        // Testează directorul temp
        $this->testTempDirectory();
        
        // Testează permisiuni
        $this->testPermissions();
        
        // Testează request cu XML
        $this->testXMLUpload();
        
        // Afișează rezultate
        $this->displayResults();
    }

    private function testConfigFile() {
        echo "<h2>1. Verificare config.json</h2>";
        
        try {
            // Verifică dacă există config.json
            if (!file_exists('config.json')) {
                throw new Exception("config.json nu există!");
            }
            
            // Încearcă să citească config.json
            $this->config = json_decode(file_get_contents('config.json'), true);
            if (!$this->config) {
                throw new Exception("config.json nu este un JSON valid!");
            }
            
            // Verifică structura
            $required = ['api_key', 'allowed_ips', 'temp_file_lifetime'];
            foreach ($required as $field) {
                if (!isset($this->config[$field])) {
                    throw new Exception("Lipsește câmpul: $field");
                }
            }
            
            $this->addResult('config', true, "config.json este valid și complet");
        } catch (Exception $e) {
            $this->addResult('config', false, $e->getMessage());
        }
    }

    private function testTempDirectory() {
        echo "<h2>2. Verificare Director Temp</h2>";
        
        try {
            if (!file_exists($this->uploadDir)) {
                mkdir($this->uploadDir, 0777, true);
                $this->addResult('temp_create', true, "Directorul temp a fost creat");
            }
            
            if (!is_writable($this->uploadDir)) {
                throw new Exception("Directorul temp nu are permisiuni de scriere!");
            }
            
            $testFile = $this->uploadDir . 'test.txt';
            if (file_put_contents($testFile, 'test')) {
                unlink($testFile);
                $this->addResult('temp_write', true, "Test scriere în temp reușit");
            } else {
                throw new Exception("Nu se poate scrie în directorul temp!");
            }
        } catch (Exception $e) {
            $this->addResult('temp_write', false, $e->getMessage());
        }
    }

    private function testPermissions() {
        echo "<h2>3. Verificare Permisiuni</h2>";
        
        // Verifică permisiuni config.json
        $configPerms = fileperms('config.json');
        $this->addResult(
            'config_perms', 
            ($configPerms & 0x0092), 
            "Permisiuni config.json: " . substr(sprintf('%o', $configPerms), -4)
        );
        
        // Verifică permisiuni temp
        $tempPerms = fileperms($this->uploadDir);
        $this->addResult(
            'temp_perms',
            ($tempPerms & 0x0777),
            "Permisiuni temp/: " . substr(sprintf('%o', $tempPerms), -4)
        );
    }

    private function testXMLUpload() {
        echo "<h2>4. Test Upload XML</h2>";
        
        // Creează un XML de test
        $testXML = '<?xml version="1.0"?><test><message>Test XML</message></test>';
        
        // Simulează un request către receiver.php
        $ch = curl_init('http://' . $_SERVER['HTTP_HOST'] . 
                       dirname($_SERVER['PHP_SELF']) . '/receiver.php');
        
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $testXML,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/xml',
                'X-Api-Key: ' . $this->config['api_key']
            ]
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode === 200) {
            $result = json_decode($response, true);
            if ($result && $result['success']) {
                $this->addResult('xml_upload', true, "Upload XML reușit");
                
                // Încearcă să șteargă fișierul
                if (isset($result['fileName'])) {
                    @unlink($this->uploadDir . $result['fileName']);
                }
            } else {
                $this->addResult('xml_upload', false, "Răspuns invalid la upload");
            }
        } else {
            $this->addResult('xml_upload', false, "Upload eșuat cu codul: $httpCode");
        }
    }

    private function addResult($test, $success, $message) {
        $this->results[$test] = [
            'success' => $success,
            'message' => $message
        ];
        
        $status = $success ? '✅' : '❌';
        echo "<div style='margin: 10px 0;'>";
        echo "<strong>$status $message</strong>";
        echo "</div>";
    }

    private function displayResults() {
        echo "<h2>Rezultate Finale</h2>";
        
        $allSuccess = true;
        foreach ($this->results as $test => $result) {
            if (!$result['success']) {
                $allSuccess = false;
                break;
            }
        }
        
        if ($allSuccess) {
            echo "<div style='color: green; font-weight: bold; font-size: 1.2em;'>";
            echo "✅ Toate testele au trecut cu succes!";
            echo "</div>";
        } else {
            echo "<div style='color: red; font-weight: bold; font-size: 1.2em;'>";
            echo "❌ Unele teste au eșuat. Verificați mesajele de mai sus.";
            echo "</div>";
        }
    }
}

// Stilizare pagină
?>
<!DOCTYPE html>
<html>
<head>
    <title>Test Configurație eFactura</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 20px auto;
            padding: 20px;
            line-height: 1.6;
        }
        h1 { color: #2c3e50; }
        h2 { color: #34495e; margin-top: 30px; }
        div { margin: 10px 0; }
        .success { color: green; }
        .error { color: red; }
    </style>
</head>
<body>
<?php
// Rulează testele
$tester = new ConfigTester();
$tester->runTests();
?>
</body>
</html>
