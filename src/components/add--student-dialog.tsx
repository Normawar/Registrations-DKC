'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMasterDb, type MasterPlayer } from "@/context/master-db-context";

interface AddStudentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  parentProfile: any;
  onStudentAdded: () => void;
}

export function AddStudentDialog({ 
  isOpen, 
  onOpenChange, 
  parentProfile, 
  onStudentAdded 
}: AddStudentDialogProps) {
  const { toast } = useToast();
  const { database, addPlayer } = useMasterDb();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    uscfId: '',
    regularRating: '',
    section: 'High School K-12',
    school: '',
    district: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please enter both first and last name.'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create new student
      const newStudent: MasterPlayer = {
        id: `student-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        uscfId: formData.uscfId.trim() || 'NEW',
        regularRating: formData.regularRating ? parseInt(formData.regularRating) : undefined,
        section: formData.section,
        school: formData.school.trim() || '',
        district: formData.district.trim() || '',
        grade: '',
        uscfExpiration: undefined,
        quickRating: undefined,
        email: '',
        events: 0,
        eventIds: [],
      };

      // Add to master database
      addPlayer(newStudent);

      // Add to parent's students list
      const parentStudentsKey = `parent_students_${parentProfile.email}`;
      const existingStudentIds = JSON.parse(localStorage.getItem(parentStudentsKey) || '[]');
      const updatedStudentIds = [...existingStudentIds, newStudent.id];
      localStorage.setItem(parentStudentsKey, JSON.stringify(updatedStudentIds));

      toast({
        title: "Student Added Successfully",
        description: `${newStudent.firstName} ${newStudent.lastName} has been added to your students.`
      });

      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        uscfId: '',
        regularRating: '',
        section: 'High School K-12',
        school: '',
        district: ''
      });

      // Close dialog and notify parent
      onOpenChange(false);
      onStudentAdded();

    } catch (error) {
      console.error('Failed to add student:', error);
      toast({
        variant: 'destructive',
        title: "Failed to Add Student",
        description: "There was an error adding the student. Please try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder="Enter first name"
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder="Enter last name"
                required
              />
            </div>
          </div>

          {/* USCF ID */}
          <div>
            <Label htmlFor="uscfId">USCF ID</Label>
            <Input
              id="uscfId"
              value={formData.uscfId}
              onChange={(e) => handleInputChange('uscfId', e.target.value)}
              placeholder="Enter USCF ID or leave blank for new member"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave blank if this is a new USCF member
            </p>
          </div>

          {/* Rating */}
          <div>
            <Label htmlFor="regularRating">Current Rating</Label>
            <Input
              id="regularRating"
              type="number"
              value={formData.regularRating}
              onChange={(e) => handleInputChange('regularRating', e.target.value)}
              placeholder="Enter current rating (optional)"
            />
          </div>

          {/* Section */}
          <div>
            <Label htmlFor="section">Section</Label>
            <Select
              value={formData.section}
              onValueChange={(value) => handleInputChange('section', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Elementary K-5">Elementary K-5</SelectItem>
                <SelectItem value="Middle School K-8">Middle School K-8</SelectItem>
                <SelectItem value="High School K-12">High School K-12</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* School Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="school">School</Label>
              <Input
                id="school"
                value={formData.school}
                onChange={(e) => handleInputChange('school', e.target.value)}
                placeholder="School name (optional)"
              />
            </div>
            <div>
              <Label htmlFor="district">District</Label>
              <Input
                id="district"
                value={formData.district}
                onChange={(e) => handleInputChange('district', e.target.value)}
                placeholder="District (optional)"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !formData.firstName.trim() || !formData.lastName.trim()}
            >
              {isSubmitting ? 'Adding...' : 'Add Student'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
