from models import (
    Client,
    OtherClient,
    Session,
    ContextManagerWithAnnotation,
    ContextManagerNoAnnotation,
    ContextManagerAbsentEnter
)

class App:
    def execute(self, obj):
        # 1. isinstance_positive
        if isinstance(obj, Client):
            obj.send()

        # 2. isinstance_scope_expiry
        if isinstance(obj, Client):
            obj.send()
        obj.send()  # unresolved

        # 3. isinstance_else_unresolved
        if isinstance(obj, Client):
            obj.send()
        else:
            obj.run()  # unresolved

        # 4. with_constructor_binding (absent __enter__ -> ContextManagerAbsentEnter)
        with ContextManagerAbsentEnter() as client:
            client.send()

        # 5. with_enter_return_type (__enter__ returns Session)
        with ContextManagerWithAnnotation() as sess:
            sess.send()

        # 6. with_unknown_enter_return (unannotated __enter__ -> unresolved)
        with ContextManagerNoAnnotation() as unk:
            unk.send()  # unresolved

        # 7. nested_narrowing
        if isinstance(obj, Client):
            if True:
                obj.send()
