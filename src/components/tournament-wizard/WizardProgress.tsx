"use client";

interface WizardStep {
  id: number;
  name: string;
  icon: string;
}

interface WizardProgressProps {
  steps: WizardStep[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  allowNavigation?: boolean;
}

export default function WizardProgress({ 
  steps, 
  currentStep, 
  onStepClick,
  allowNavigation = false 
}: WizardProgressProps) {
  return (
    <div className="w-full">
      {/* Mobile Progress Bar */}
      <div className="sm:hidden mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Step {currentStep} of {steps.length}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {steps[currentStep - 1]?.name}
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop Steps */}
      <div className="hidden sm:flex items-center justify-between relative">
        {/* Progress Line Background */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700" />
        
        {/* Active Progress Line */}
        <div
          className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isClickable = allowNavigation && (isCompleted || step.id === currentStep);

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center">
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(step.id)}
                disabled={!isClickable}
                className={`w-10 h-10 rounded-full flex items-center justify-center 
                           font-semibold text-sm transition-all duration-300
                           ${isCompleted 
                             ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg" 
                             : isCurrent
                               ? "bg-white dark:bg-gray-800 border-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-md"
                               : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                           }
                           ${isClickable ? "cursor-pointer hover:scale-110" : "cursor-default"}
                          `}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>{step.icon}</span>
                )}
              </button>
              <span className={`mt-2 text-xs font-medium transition-colors
                              ${isCurrent 
                                ? "text-indigo-600 dark:text-indigo-400" 
                                : isCompleted
                                  ? "text-gray-900 dark:text-white"
                                  : "text-gray-400 dark:text-gray-500"
                              }`}>
                {step.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
