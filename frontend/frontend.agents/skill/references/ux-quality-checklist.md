
# LMS UI/UX Quality Checklist

## Visual Consistency

- [ ] Correct Navy / Blue / White palette
- [ ] Consistent spacing and typography
- [ ] Consistent button and card styles
- [ ] No unnecessary gradients
- [ ] Clear visual hierarchy

## Navigation

- [ ] Sidebar matches the current role
- [ ] Active route is highlighted
- [ ] Breadcrumb is correct
- [ ] Class tabs are consistent
- [ ] No unexpected dead ends

## Interaction

- [ ] Buttons have clear behavior
- [ ] Forms have validation feedback
- [ ] Destructive actions require confirmation
- [ ] Approval statuses are visible
- [ ] Success/error messages are meaningful
- [ ] Unsupported actions are clearly marked

## Workflow Compliance

- [ ] Role permissions match source workflow
- [ ] Enrollment states are represented
- [ ] Lesson approval states are represented
- [ ] Attendance states are represented
- [ ] Test and Assignment are distinguished
- [ ] Quiz results hide answer keys
- [ ] Completion tracks are separated
- [ ] Requests and Notifications are distinct

## Responsive

- [ ] Desktop layout works
- [ ] Sidebar works on mobile
- [ ] No unintended horizontal overflow
- [ ] Tables remain usable on small screens
- [ ] Dialogs fit small viewports

## Accessibility

- [ ] Keyboard navigation works
- [ ] Focus indicators are visible
- [ ] Form inputs have labels
- [ ] Meaningful color contrast
- [ ] Status is not color-only
- [ ] Reduced-motion support

## Quality Gate

- [ ] Available lint checks pass
- [ ] Available typecheck passes
- [ ] Available build checks pass
- [ ] No known critical UI runtime errors
- [ ] Main demo navigation is usable

Report failures rather than silently
marking checks as complete.
