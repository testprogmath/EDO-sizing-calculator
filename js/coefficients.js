const COEFFICIENTS = {
    'EAP-TLS': {
        nominalRpsPerPod: 20.0,          // Комфортный RPS на один pod (без OCSP)
        cpuPeakPerRps: 0.09,              // Пиковое потребление CPU (core) на 1 RPS/pod
        memPeakPerRpsMiB: 40.0,           // Пиковое потребление памяти (MiB) на 1 RPS/pod
        ocspOverheadPct: 14.0,            // Надбавка OCSP, %
        baselineNodeCpuP95: 5.1           // Базовая нагрузка на ноду CPU
    },
    
    'MAB': {
        nominalRpsPerPod: 27.0,           // Комфортный RPS на один pod
        cpuPeakPerRps: 0.08871,           // Пиковое потребление CPU (core) на 1 RPS/pod
        memPeakPerRpsMiB: 32.44,          // Пиковое потребление памяти (MiB) на 1 RPS/pod
        baselineNodeCpuP95: 4.0           // Базовая нагрузка на ноду CPU
    },
    
    'PEAP': {
        nominalRpsPerPod: 12.0,           // Комфортный RPS на один pod
        cpuPeakPerRps: 0.21,              // Пиковое потребление CPU (core) на 1 RPS/pod
        memPeakPerRpsMiB: 70.0,           // Пиковое потребление памяти (MiB) на 1 RPS/pod
        baselineNodeCpuP95: 4.0           // Базовая нагрузка на ноду CPU
    },
    
    common: {
        safetyFactor: 1.25,               // Запас между peak и limit по ресурсам pod
        maxNodeUtilization: 0.7,          // Максимальная целевая загрузка ноды (70%)
        nodeHeadroom: 1.15,               // Запас на ноде
        requestRatio: 0.6                 // Соотношение request/limit
    }
};

const PROFILES = {
    'EAP-TLS': [
        { maxDevices: 5000, name: 'A: до 5k устройств', minPods: 3, nodeCpu: 8, nodeMemory: 24 },
        { maxDevices: 10000, name: 'B: 5k–10k', minPods: 6, nodeCpu: 12, nodeMemory: 32 },
        { maxDevices: 12000, name: 'C: 10k–12k', minPods: 6, nodeCpu: 16, nodeMemory: 48 },
        { maxDevices: 15000, name: 'D: 12k–15k', minPods: 6, nodeCpu: 16, nodeMemory: 64 },
        { maxDevices: 20000, name: 'E: 15k–20k', minPods: 6, nodeCpu: 24, nodeMemory: 48 },
    ],
    
    'MAB': [
        { maxDevices: 5000, name: 'A: до 5k устройств', minPods: 2, nodeCpu: 8, nodeMemory: 24 },
        { maxDevices: 10000, name: 'B: 5k–10k', minPods: 3, nodeCpu: 8, nodeMemory: 32 },
        { maxDevices: 12000, name: 'C: 10k–12k', minPods: 4, nodeCpu: 12, nodeMemory: 48 },
        { maxDevices: 15000, name: 'D: 12k–15k', minPods: 4, nodeCpu: 16, nodeMemory: 64 },
        { maxDevices: 20000, name: 'E: 15k–20k', minPods: 6, nodeCpu: 16, nodeMemory: 48 },
    ],
    
    'PEAP': [
        { maxDevices: 5000, name: 'A: до 5k устройств', minPods: 4, nodeCpu: 8, nodeMemory: 24 },
        { maxDevices: 10000, name: 'B: 5k–10k', minPods: 4, nodeCpu: 12, nodeMemory: 32 },
        { maxDevices: 12000, name: 'C: 10k–12k', minPods: 6, nodeCpu: 16, nodeMemory: 48 },
        { maxDevices: 15000, name: 'D: 12k–15k', minPods: 6, nodeCpu: 16, nodeMemory: 64 },
        { maxDevices: 20000, name: 'E: 15k–20k', minPods: 8, nodeCpu: 24, nodeMemory: 48 },
    ]
};

const CPU_SIZES = [4, 8, 12, 16, 24, 32, 48, 64];

const MEMORY_SIZES = [8, 16, 24, 32, 48, 64, 96, 128];

function getProfile(authMethod, deviceCount) {
    const profiles = PROFILES[authMethod];
    if (!profiles) return null;
    
    for (const profile of profiles) {
        if (deviceCount <= profile.maxDevices) {
            return profile;
        }
    }
    
    return profiles[profiles.length - 1];
}

function roundUpToCpuSize(value) {
    for (const size of CPU_SIZES) {
        if (value <= size) return size;
    }
    return CPU_SIZES[CPU_SIZES.length - 1];
}

function roundUpToMemorySize(value) {
    for (const size of MEMORY_SIZES) {
        if (value <= size) return size;
    }
    return MEMORY_SIZES[MEMORY_SIZES.length - 1];
}

function getBaselineNodeMemGiB(devices) {
    return 10.0 + devices * 0.0006;
}

function getNodeMemorySize(devices, calculatedMemory, authMethod) {
    if (authMethod === 'EAP-TLS' || authMethod === 'MAB') {
        if (devices <= 5000) {
            return Math.max(24, calculatedMemory);
        } else if (devices <= 10000) {
            return Math.max(32, calculatedMemory);
        } else if (devices <= 15000) {
            return Math.max(48, calculatedMemory);
        } else if (devices <= 20000) {
            return Math.max(48, calculatedMemory);
        }
    }
    
    if (authMethod === 'PEAP') {
        if (devices <= 5000) {
            return Math.max(24, calculatedMemory);
        } else if (devices <= 10000) {
            return Math.max(32, calculatedMemory);
        } else if (devices <= 15000) {
            return Math.max(48, calculatedMemory);
        } else if (devices <= 20000) {
            return Math.max(64, calculatedMemory);
        }
    }
    
    return calculatedMemory;
}