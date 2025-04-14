<?php
// Database connection file
require_once __DIR__ . '/config.php';

// Create global database connection
try {
    $db = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", 
        DB_USER, 
        DB_PASS, 
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );
    
    // Set timezone for database operations
    $db->exec("SET time_zone = '-03:00'");
    
} catch (PDOException $e) {
    // Log error and display friendly message
    error_log("Database connection error: " . $e->getMessage());
    die("Error connecting to database. Please try again later or contact support.");
}
?>
