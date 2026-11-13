import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle2, Info } from "lucide-react";

interface AssessmentInstructionsProps {
    title: string;
    description: string;
    steps: string[];
    onStart: () => void;
    icon?: React.ReactNode;
}

const AssessmentInstructions: React.FC<AssessmentInstructionsProps> = ({
    title,
    description,
    steps,
    onStart,
    icon
}) => {
    return (
        <Card className="w-full max-w-3xl mx-auto shadow-lg border-t-4 border-t-app-blue">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-white pb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-full text-app-blue">
                        {icon || <Info size={24} />}
                    </div>
                    <div>
                        <CardTitle className="text-2xl text-app-blue">{title}</CardTitle>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                    {description}
                </p>

                <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 mb-8">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <CheckCircle2 size={20} className="text-green-600" />
                        Instructions:
                    </h3>
                    <ul className="space-y-4">
                        {steps.map((step, index) => (
                            <li key={index} className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold mt-0.5">
                                    {index + 1}
                                </span>
                                <span className="text-gray-700">{step}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </CardContent>
            <CardFooter className="flex justify-center pb-8">
                <Button
                    onClick={onStart}
                    size="lg"
                    className="px-8 py-6 text-lg bg-app-blue hover:bg-app-blue-dark shadow-md transition-all hover:scale-105"
                >
                    <Play fill="currentColor" className="mr-2 h-5 w-5" />
                    Start Assessment
                </Button>
            </CardFooter>
        </Card>
    );
};

export default AssessmentInstructions;
