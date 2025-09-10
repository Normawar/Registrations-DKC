
'use client';

import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/app-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, FileQuestion } from 'lucide-react';
import { helpTopics, type HelpTopic } from '@/lib/data/help-data';
import Link from 'next/link';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// A simple markdown-to-HTML renderer
const MarkdownRenderer = ({ content }: { content: string }) => {
    const lines = content.trim().split('\n');
    const html = lines.map((line, index) => {
        if (line.startsWith('## ')) {
            return <h2 key={index} className="text-2xl font-bold mt-6 mb-3 border-b pb-2">{line.substring(3)}</h2>;
        }
        if (line.startsWith('### ')) {
            return <h3 key={index} className="text-xl font-semibold mt-4 mb-2">{line.substring(4)}</h3>;
        }
        if (line.trim().match(/^\d+\./)) {
            return <p key={index} className="mb-2 pl-4">{line}</p>;
        }
        if (line.trim() === '') {
            return <br key={index} />;
        }
        return <p key={index} className="mb-4 text-muted-foreground leading-relaxed">{line}</p>;
    }).reduce((acc, elem, index) => {
        if (elem.props.className?.includes('pl-4')) {
            const prev = acc[acc.length - 1];
            if (prev && prev.type === 'ol') {
                prev.props.children.push(<li key={index}>{elem}</li>);
            } else {
                acc.push(<ol key={index} className="list-decimal list-inside space-y-2">{<li>{elem}</li>}</ol>);
            }
        } else {
            acc.push(elem);
        }
        return acc;
    }, [] as JSX.Element[]);
    
    return <>{html}</>;
};

export default function HelpPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);

    const filteredTopics = useMemo(() => {
        if (!searchTerm) {
            return helpTopics;
        }
        const lowercasedTerm = searchTerm.toLowerCase();
        return helpTopics.filter(topic =>
            topic.title.toLowerCase().includes(lowercasedTerm) ||
            topic.keywords.some(keyword => keyword.toLowerCase().includes(lowercasedTerm))
        );
    }, [searchTerm]);

    const handleTopicSelect = (topic: HelpTopic) => {
        setSelectedTopic(topic);
        const element = document.getElementById('topic-content');
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <AppLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Help Center</h1>
                    <p className="text-muted-foreground">Find answers and step-by-step guides for using ChessMate.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 items-start">
                    {/* Left Column: Index and Search */}
                    <div className="md:col-span-1 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Search Topics</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="e.g., 'invoice' or 'roster'"
                                        className="pl-10"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Help Topics</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {filteredTopics.map(topic => (
                                        <li key={topic.id}>
                                            <button 
                                                onClick={() => handleTopicSelect(topic)}
                                                className="w-full text-left p-2 rounded-md hover:bg-accent flex items-center gap-3 transition-colors"
                                            >
                                                <topic.icon className="h-5 w-5 text-primary" />
                                                <span className="font-medium">{topic.title}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Content */}
                    <div id="topic-content" className="md:col-span-2">
                       <Card className="min-h-[60vh]">
                           <CardContent className="p-6">
                                {selectedTopic ? (
                                    <article>
                                        <div className="flex items-center gap-4 mb-4">
                                            <selectedTopic.icon className="h-8 w-8 text-primary" />
                                            <h1 className="text-3xl font-bold font-headline">{selectedTopic.title}</h1>
                                        </div>
                                        <MarkdownRenderer content={selectedTopic.content} />
                                    </article>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-16">
                                        <FileQuestion className="h-16 w-16 mb-4" />
                                        <h2 className="text-xl font-semibold text-foreground">Welcome to the Help Center</h2>
                                        <p>Select a topic from the left to get started, or use the search bar to find what you're looking for.</p>
                                    </div>
                                )}
                           </CardContent>
                       </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
