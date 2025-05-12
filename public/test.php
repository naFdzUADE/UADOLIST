<?php
require_once '../config/database.php';

// Asegurarse de que el script solo se ejecute en entorno de desarrollo
if ($_SERVER['SERVER_ADDR'] !== '127.0.0.1' && $_SERVER['SERVER_ADDR'] !== '::1') {
    die('Este script solo puede ejecutarse en entorno local');
}

try {
    // Primero, eliminar todas las tareas existentes
    $db->beginTransaction();
    $db->exec("DELETE FROM tareas");
    $db->commit();
    
    echo "Se han eliminado todas las tareas existentes.<br>";
    
    // Definir el rango de fechas
    $fechaInicio = strtotime('2025-05-04');
    $fechaFin = strtotime('2025-05-17');
    $rangoDias = ($fechaFin - $fechaInicio) / 86400; // Número de días en el rango
    $totalDias = $rangoDias + 1; // Incluir el día final
    
    // Insertar 1000 tareas nuevas
    $db->beginTransaction();
    
    $insertStmt = $db->prepare("
        INSERT INTO tareas (usuario_id, titulo, descripcion, fecha_limite, estado, fecha_creacion) 
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    
    $totalTareas = 1000;
    $tareasCompletadas = floor($totalTareas * 0.3); // 30% completadas
    $tareasPendientes = $totalTareas - $tareasCompletadas; // 70% pendientes
    
    // Crear arrays para distribuir tareas
    $estados = array_merge(
        array_fill(0, $tareasPendientes, 'pendiente'),
        array_fill(0, $tareasCompletadas, 'completada')
    );
    
    // Mezclar el array para que las tareas completadas y pendientes estén distribuidas
    shuffle($estados);
    
    // Calcular cuántas tareas por día (distribuir uniformemente)
    $tareasPorDia = ceil($totalTareas / $totalDias);
    
    // Contadores
    $tareaActual = 1;
    
    // Generar tareas día por día, secuencialmente
    for ($dia = 0; $dia < $totalDias; $dia++) {
        $fechaLimite = date('Y-m-d', $fechaInicio + ($dia * 86400));
        
        // Determinar cuántas tareas generar para este día
        $tareasParaEsteDia = $tareasPorDia;
        
        // Ajustar para el último día si excede el total
        if ($tareaActual + $tareasParaEsteDia - 1 > $totalTareas) {
            $tareasParaEsteDia = $totalTareas - $tareaActual + 1;
        }
        
        // Generar tareas para este día
        for ($i = 0; $i < $tareasParaEsteDia; $i++) {
            if ($tareaActual > $totalTareas) {
                break; // Salir si ya generamos todas las tareas
            }
            
            $titulo = "Tarea #{$tareaActual}";
            $descripcion = "Descripción de la tarea número {$tareaActual}";
            
            // Asignar fecha de creación (entre 1 y 14 días antes de la fecha límite)
            $diasAntesCreacion = mt_rand(1, 14);
            $fechaCreacion = date('Y-m-d H:i:s', strtotime($fechaLimite) - ($diasAntesCreacion * 86400));
            
            // Asignar estado (tomado del array mezclado)
            $estado = $estados[$tareaActual - 1];
            
            // Usuario ID = 1
            $usuarioId = 1;
            
            $insertStmt->execute([$usuarioId, $titulo, $descripcion, $fechaLimite, $estado, $fechaCreacion]);
            
            $tareaActual++;
        }
    }
    
    $db->commit();
    echo "Se han generado exactamente 1000 tareas con títulos numerados del 1 al 1000.<br>";
    echo "Las tareas están distribuidas secuencialmente por fechas entre el 04/05/2025 y el 17/05/2025.<br>";
    echo "Cada día contiene aproximadamente " . $tareasPorDia . " tareas consecutivas.<br>";
    echo "Aproximadamente el 70% son pendientes y el 30% completadas.<br>";
    
} catch (PDOException $e) {
    if (isset($db)) {
        $db->rollBack();
    }
    echo "Error: " . $e->getMessage();
}
?>

<p>
    <a href="index.php" style="display: inline-block; margin-top: 20px; padding: 10px 15px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">Volver a la aplicación</a>
</p>